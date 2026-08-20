import type { PerspectiveId } from "../perspectives/contracts.ts";
import type { AutonomousInsight, CurrentDataDiscoveryRun } from "./current-data-discovery.ts";

export const HYPOTHESIS_BACKLOG_VERSION = "cross-source-hypothesis-backlog-v1" as const;

export type CrossSourceHypothesisLead = {
  hypothesisId: string;
  marketName: string;
  departments: PerspectiveId[];
  status: "ready_to_test" | "waiting_for_join";
  headline: string;
  hypothesis: string;
  whyItEmerged: string;
  evidencePreview: string[];
  nextTest: string;
  falsificationRule: string;
  requiredInputs: string[];
  sourceIds: string[];
};

const PAIR_TEMPLATES: Record<string, Omit<CrossSourceHypothesisLead, "hypothesisId" | "marketName" | "departments" | "status" | "whyItEmerged" | "evidencePreview" | "sourceIds">> = {
  "marketing+pricing": {
    headline: "Test whether local price position helps explain acquisition efficiency",
    hypothesis: "The market's paid-media response may be partly explained by local matched-SKU price position or competitor availability, not media execution alone.",
    nextTest: "Join same-period query and campaign performance to current PetSmart/Petco/Walmart matched-SKU price index, availability, Dog Food orders, new customers, and contribution; compare with matched markets while controlling for channel mix.",
    falsificationRule: "Reject the hypothesis when acquisition efficiency does not change with price position after matched-market and customer-outcome controls, or when the apparent relationship disappears after freshness and coverage checks.",
    requiredInputs: ["same-period paid-media performance", "current matched-SKU competitor price and availability", "Dog Food orders and new customers", "contribution after media cost"],
  },
  "cvc+pricing": {
    headline: "Test whether local retail conditions change the clinic opportunity",
    hypothesis: "The market's clinic-demand or footprint signal may vary with local retailer assortment, availability, and price conditions that affect customer acquisition and retention.",
    nextTest: "Join current clinic appointments, staffed capacity, new-to-Chewy mix, contribution, and trade-area overlap to matched-SKU competitor availability and price position; compare with mature clinic peers.",
    falsificationRule: "Reject the hypothesis when clinic outcomes are unchanged after controlling for staffed capacity, clinic maturity, and household demand, or when competitor coverage is too sparse to represent the trade area.",
    requiredInputs: ["current completed appointments and staffed capacity", "clinic maturity and contribution", "trade-area overlap", "current matched-SKU competitor price and availability"],
  },
  "cvc+marketing": {
    headline: "Test whether clinic capacity explains regional media response",
    hypothesis: "The market's media response may translate into different customer value depending on clinic demand, staffed appointment capacity, and new-to-Chewy acquisition mix.",
    nextTest: "Join same-period media exposure and attributed response to completed appointments, new-to-Chewy customers, staffed capacity, and contribution; compare against matched clinic markets.",
    falsificationRule: "Reject the hypothesis when media response does not predict incremental clinic outcomes after capacity and matched-market controls.",
    requiredInputs: ["same-period media exposure", "completed appointments", "new-to-Chewy customers", "staffed capacity", "contribution after media cost"],
  },
};

function pairKey(departments: PerspectiveId[]) {
  return [...departments].sort().join("+");
}

function stableId(value: unknown) {
  const text = JSON.stringify(value);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    left = Math.imul(left ^ text.charCodeAt(index), 0x01000193) >>> 0;
    right = Math.imul(right ^ text.charCodeAt(index), 0x85ebca6b) >>> 0;
  }
  return left.toString(16).padStart(8, "0") + right.toString(16).padStart(8, "0").slice(0, 4);
}

function outcomeConnected(findings: AutonomousInsight[]) {
  return findings.some((finding) => finding.businessValue.status === "outcome_connected");
}

export function buildCrossSourceHypothesisBacklog(run: Pick<CurrentDataDiscoveryRun, "findings">): CrossSourceHypothesisLead[] {
  const byMarket = new Map<string, AutonomousInsight[]>();
  for (const finding of run.findings) byMarket.set(finding.marketName, [...(byMarket.get(finding.marketName) ?? []), finding]);

  const backlog: CrossSourceHypothesisLead[] = [];
  for (const [marketName, findings] of byMarket) {
    const departments = [...new Set(findings.map((finding) => finding.department))].sort();
    if (departments.length < 2) continue;
    for (let left = 0; left < departments.length - 1; left += 1) {
      for (let right = left + 1; right < departments.length; right += 1) {
        const pair = [departments[left]!, departments[right]!] as PerspectiveId[];
        const template = PAIR_TEMPLATES[pairKey(pair)];
        if (!template) continue;
        const pairFindings = findings.filter((finding) => pair.includes(finding.department));
        const sourceIds = [...new Set(pairFindings.flatMap((finding) => finding.sourceIds))].sort();
        const requiredInputs = [...new Set(pairFindings.flatMap((finding) => finding.businessValue.requiredInputs).concat(template.requiredInputs))];
        backlog.push({
          hypothesisId: `emerging:${stableId({ marketName, pair, sourceIds })}`,
          marketName,
          departments: pair,
          status: outcomeConnected(pairFindings) && sourceIds.length >= 2 ? "ready_to_test" : "waiting_for_join",
          headline: template.headline,
          hypothesis: template.hypothesis,
          whyItEmerged: `${pairFindings.length} qualified signals from ${pair.join(" and ")} independently surfaced in the same market. This is a new question to test, not proof that one caused the other.`,
          evidencePreview: pairFindings.slice(0, 4).map((finding) => `${finding.department}: ${finding.headline}`),
          nextTest: template.nextTest,
          falsificationRule: template.falsificationRule,
          requiredInputs,
          sourceIds,
        });
      }
    }
  }
  return backlog.sort((left, right) => {
    if (left.status !== right.status) return left.status === "ready_to_test" ? -1 : 1;
    return left.marketName.localeCompare(right.marketName) || left.hypothesisId.localeCompare(right.hypothesisId);
  });
}
