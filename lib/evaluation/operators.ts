export type EvaluationRow = { entityId: string; entityLabel: string; values: Record<string, number | string | null>; metadata: Record<string, unknown> };
export type OperatorContext = { rows: EvaluationRow[]; warnings: string[]; comparisons: Record<string, number>; selectedEntityIds: string[] };
export type Operator = (context: OperatorContext, parameters: Record<string, unknown>) => OperatorContext;

function numeric(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function quantileMedian(values: number[]) { const ordered = [...values].sort((a, b) => a - b); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; }

export const OPERATOR_REGISTRY: Readonly<Record<string, Operator>> = {
  establish_eligibility(context, parameters) {
    const field = String(parameters.field); const minimum = Number(parameters.minimum ?? -Infinity); const maximum = Number(parameters.maximum ?? Infinity);
    const rows = context.rows.filter((row) => numeric(row.values[field]) && Number(row.values[field]) >= minimum && Number(row.values[field]) <= maximum);
    return { ...context, rows, warnings: rows.length === context.rows.length ? context.warnings : [...context.warnings, `${context.rows.length - rows.length} entities were excluded by the declared eligibility rule.`] };
  },
  filter_scope(context, parameters) {
    const field = String(parameters.field); const expected = parameters.equals;
    return { ...context, rows: context.rows.filter((row) => row.values[field] === expected) };
  },
  aggregate(context, parameters) {
    const groupField = String(parameters.groupField); const valueField = String(parameters.valueField); const outputField = String(parameters.outputField); const method = String(parameters.method ?? "sum");
    const groups = new Map<string, EvaluationRow[]>(); for (const row of context.rows) { const key = String(row.values[groupField]); groups.set(key, [...(groups.get(key) ?? []), row]); }
    const rows = [...groups].map(([key, group]) => { const values = group.map((row) => row.values[valueField]).filter(numeric); const value = method === "mean" ? values.reduce((a,b)=>a+b,0)/values.length : values.reduce((a,b)=>a+b,0); return { entityId:key, entityLabel:key, values:{ [groupField]:key, [outputField]:value }, metadata:{ aggregatedFrom:group.length, method } }; });
    return { ...context, rows };
  },
  derive_metric(context, parameters) {
    const numerator = String(parameters.numerator); const denominator = String(parameters.denominator); const outputField = String(parameters.outputField); const scale = Number(parameters.scale ?? 1);
    return { ...context, rows: context.rows.map((row) => ({ ...row, values: { ...row.values, [outputField]: numeric(row.values[numerator]) && numeric(row.values[denominator]) && row.values[denominator] !== 0 ? Number(row.values[numerator]) / Number(row.values[denominator]) * scale : null } })) };
  },
  select_peer_cohort(context, parameters) {
    const field = String(parameters.field); const tolerance = Number(parameters.tolerance ?? 0); const anchor = Number(parameters.anchor);
    return { ...context, rows: context.rows.filter((row) => numeric(row.values[field]) && Math.abs(Number(row.values[field]) - anchor) <= tolerance) };
  },
  compare_to_peer_median(context, parameters) {
    const field = String(parameters.field); const values = context.rows.map((row) => row.values[field]).filter(numeric); if (!values.length) return { ...context, warnings:[...context.warnings, `No comparable values were available for ${field}.`] };
    const median = quantileMedian(values); return { ...context, comparisons:{ ...context.comparisons, [`${field}:peer_median`]:median }, rows:context.rows.map((row)=>({ ...row, values:{ ...row.values, [`${field}_peer_difference`]:numeric(row.values[field]) ? Number(row.values[field])-median : null }, metadata:{...row.metadata, peerMedian:median} })) };
  },
  compare_threshold(context, parameters) {
    const field=String(parameters.field); const threshold=Number(parameters.threshold); return { ...context, rows:context.rows.map((row)=>({...row, values:{...row.values,[`${field}_threshold_pass`]:numeric(row.values[field]) && Number(row.values[field])>=threshold ? 1 : 0}})), comparisons:{...context.comparisons,[`${field}:threshold`]:threshold} };
  },
  normalize_min_max(context, parameters) {
    const field=String(parameters.field); const outputField=String(parameters.outputField ?? `${field}_normalized`); const values=context.rows.map((row)=>row.values[field]).filter(numeric); const min=Number(parameters.minimum ?? Math.min(...values)); const max=Number(parameters.maximum ?? Math.max(...values));
    return {...context, rows:context.rows.map((row)=>({...row,values:{...row.values,[outputField]:numeric(row.values[field])&&max!==min?((Number(row.values[field])-min)/(max-min))*100:null}}))};
  },
  apply_weights(context, parameters) {
    const weights=parameters.weights as Record<string,number>; return {...context,rows:context.rows.map((row)=>{const contributions:Record<string,number|null>={};let score=0;for(const [field,weight] of Object.entries(weights)){const value=row.values[field];contributions[`${field}_contribution`]=numeric(value)?Number(value)*weight/100:null;if(numeric(value))score+=Number(value)*weight/100;}return {...row,values:{...row.values,...contributions,weighted_score:Math.round(score*100)/100}};})};
  },
  rank(context, parameters) {
    const field=String(parameters.field); const direction=String(parameters.direction ?? "descending"); const rows=[...context.rows].sort((a,b)=>(direction==="ascending"?1:-1)*(Number(a.values[field])-Number(b.values[field]))||a.entityId.localeCompare(b.entityId)).map((row,index)=>({...row,values:{...row.values,rank:index+1}})); return {...context,rows,selectedEntityIds:rows.map((row)=>row.entityId)};
  },
  validate(context, parameters) {
    const fields=(parameters.fields as string[])??[]; const missing=context.rows.flatMap((row)=>fields.filter((field)=>row.values[field]===null||row.values[field]===undefined).map((field)=>`${row.entityLabel}: ${field}`)); return {...context,warnings:missing.length?[...context.warnings,`Missing evidence: ${missing.join(", ")}.`]:context.warnings};
  },
  deterministic_disposition(context, parameters) {
    const field=String(parameters.field); const advance=Number(parameters.advanceThreshold); const defer=Number(parameters.deferThreshold); return {...context,rows:context.rows.map((row)=>{const value=Number(row.values[field]);const disposition=value>=advance?String(parameters.advanceLabel):value>=defer?String(parameters.deferLabel):String(parameters.stopLabel);return {...row,values:{...row.values,disposition}};})};
  },
};

export function executeOperatorPlan(rows: EvaluationRow[], plan: readonly { operator:string; parameters:Record<string,unknown> }[]) {
  return plan.reduce((context, invocation) => { const operator=OPERATOR_REGISTRY[invocation.operator]; if(!operator) throw new Error(`Unregistered evaluation operator: ${invocation.operator}`); return operator(context,invocation.parameters); }, { rows:[...rows], warnings:[], comparisons:{}, selectedEntityIds:[] } as OperatorContext);
}
