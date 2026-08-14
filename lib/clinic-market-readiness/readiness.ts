import { canonicalObservationSchema, READINESS_CALCULATION_VERSION, READINESS_QUERY_VERSION, type CanonicalObservation, type QualityReport, type ReadinessPacket } from "./contracts.ts";

const REQUIRED_DOMAINS = ["market_context", "clinic_identity", "clinic_performance"] as const;

function usable(observation: CanonicalObservation): boolean {
  return observation.quality_status !== "rejected" && observation.raw_value !== null;
}

export function buildReadinessPacket(input: {
  snapshotVersion: string;
  marketId: string;
  observations: unknown[];
  qualityReport: QualityReport;
}): ReadinessPacket {
  const observations = input.observations.map((value) => canonicalObservationSchema.parse(value));
  const marketObservations = observations.filter((observation) => observation.market_id === input.marketId);
  const market = marketObservations[0]
    ? { marketId: input.marketId, cbsaCode: marketObservations[0].cbsa_code, marketName: marketObservations[0].market_name, synthetic: marketObservations[0].is_synthetic }
    : null;
  const availableDomains = [...new Set(marketObservations.filter(usable).map((observation) => observation.evidence_domain))];
  const percentage = availableDomains.filter((domain) => REQUIRED_DOMAINS.includes(domain as (typeof REQUIRED_DOMAINS)[number])).length / REQUIRED_DOMAINS.length;
  const missingEvidence = REQUIRED_DOMAINS.filter((domain) => !availableDomains.includes(domain)).map((domain) => `Missing usable ${domain} evidence.`);
  const blockers = [...missingEvidence];
  const warnings: string[] = [];
  const synthetic = market?.synthetic ?? false;

  if (!market) blockers.unshift(`Market ${input.marketId} was not found in snapshot ${input.snapshotVersion}.`);
  if (marketObservations.some((observation) => observation.quality_status === "rejected")) blockers.push("Rejected observations are present and excluded from evaluation.");
  if (marketObservations.some((observation) => observation.sensitivity === "restricted")) warnings.push("Restricted observations were excluded from the returned packet.");
  if (!synthetic && marketObservations.some((observation) => observation.evidence_domain === "clinic_performance" && observation.warning)) {
    warnings.push("Clinic performance evidence is available with a definition warning.");
  }
  if (!synthetic && marketObservations.some((observation) => observation.cbsa_code === null)) {
    blockers.push("The market does not have an exact stable CBSA assignment.");
  }
  if (!synthetic && marketObservations.some((observation) => observation.evidence_status === "Unknown")) {
    blockers.push("Required evidence includes an Unknown evidence status.");
  }
  if (!synthetic && percentage < 0.8) blockers.push(`Completeness is ${(percentage * 100).toFixed(0)}%, below the 80% threshold.`);
  if (synthetic) warnings.push("This packet is synthetic and is reviewable for workflow demonstration only.");

  return {
    packetVersion: "clinic-market-evidence-packet-v1",
    packetStatus: blockers.length === 0 ? "reviewable" : "blocked",
    snapshotVersion: input.snapshotVersion,
    queryVersion: READINESS_QUERY_VERSION,
    calculationVersion: READINESS_CALCULATION_VERSION,
    market,
    evidence: marketObservations.filter((observation) => observation.sensitivity !== "restricted"),
    completeness: { requiredDomains: [...REQUIRED_DOMAINS], availableDomains, percentage, threshold: 0.8 },
    blockers,
    warnings,
    missingEvidence,
    qualityFindingIds: input.qualityReport.findings.filter((finding) => finding.status !== "passed").map((finding) => finding.findingId),
    allowedUse: synthetic ? "synthetic_prototype_only" : "approved_internal_decision_support",
    scoringEligibility: "none",
  };
}
