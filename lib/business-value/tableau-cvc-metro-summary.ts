import snapshot from "../../data/approved/cvc-metro-outcomes/current.json" with { type: "json" };

type SnapshotRecord = (typeof snapshot.records)[number];

export type TableauCvcMetroSummary = {
  metro: string;
  periodStart: string;
  periodEnd: string;
  spend: number;
  completedAppointments: number;
  newToChewyAppointments: number;
  netSales: number;
  completedAppointmentsPerThousandSpend: number;
  netSalesPerThousandSpend: number;
  newToChewyShare: number | null;
  channelCount: number;
};

export const TABLEAU_CVC_OUTCOME_SNAPSHOT_VERSION = snapshot.version;
export const TABLEAU_CVC_OUTCOME_SOURCE_ID = snapshot.sourceId;

export function getTableauCvcMetroSummaries(): TableauCvcMetroSummary[] {
  const groups = new Map<string, { records: SnapshotRecord[]; channels: Set<string> }>();
  for (const record of snapshot.records) {
    const group = groups.get(record.metro) ?? { records: [], channels: new Set<string>() };
    group.records.push(record);
    group.channels.add(record.channel);
    groups.set(record.metro, group);
  }
  return [...groups].map(([metro, group]) => {
    const spend = group.records.reduce((total, record) => total + record.spend, 0);
    const completedAppointments = group.records.reduce((total, record) => total + record.completedAppointments, 0);
    const newToChewyAppointments = group.records.reduce((total, record) => total + record.newToChewyAppointments, 0);
    const netSales = group.records.reduce((total, record) => total + record.netSales, 0);
    return {
      metro,
      periodStart: snapshot.period.start,
      periodEnd: snapshot.period.end,
      spend,
      completedAppointments,
      newToChewyAppointments,
      netSales,
      completedAppointmentsPerThousandSpend: spend > 0 ? completedAppointments / spend * 1000 : 0,
      netSalesPerThousandSpend: spend > 0 ? netSales / spend * 1000 : 0,
      newToChewyShare: completedAppointments > 0 ? newToChewyAppointments / completedAppointments : null,
      channelCount: group.channels.size,
    };
  }).sort((left, right) => right.netSalesPerThousandSpend - left.netSalesPerThousandSpend || left.metro.localeCompare(right.metro));
}

export function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
