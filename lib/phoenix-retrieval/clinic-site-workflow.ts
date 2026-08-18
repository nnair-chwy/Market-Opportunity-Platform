import type { EvaluationPlan } from "../planning/contracts.ts";
import {
  clinicSiteWorkflowResultSchema,
  type ClinicResearchStep,
  type ClinicSiteWorkflowResult,
} from "./contracts.ts";
import { LocalEvidenceRetriever } from "./local-retriever.ts";

const SNAPSHOT_VERSION = "approved-snowflake-2026-08-11-v1";

function researchSteps(): ClinicResearchStep[] {
  return [
    {
      id: "confirm-trade-area",
      title: "Confirm the Phoenix trade area or submarket definition",
      reason: "CBSA context is useful for screening but does not establish a clinic service area or drive-time catchment.",
      owner: "Market Intelligence and Clinic Strategy",
      priority: "next",
    },
    {
      id: "collect-property-evidence",
      title: "Collect candidate property and accessibility evidence",
      reason: "The current evidence bundle does not establish property availability, visibility, parking, access, or buildout feasibility.",
      owner: "Real Estate Analytics",
      priority: "next",
    },
    {
      id: "validate-staffing-feasibility",
      title: "Validate staffing and operating feasibility",
      reason: "A market comparison cannot establish veterinarian, technician, or clinic leadership availability.",
      owner: "CVC Operations",
      priority: "next",
    },
    {
      id: "approve-performance-definition",
      title: "Define the comparable clinic outcome and maturity window",
      reason: "Clinic performance data is available as descriptive evidence; site scoring requires documented outcome, maturity, cohort, and owner configuration.",
      owner: "CVC Analytics and Finance metric owner",
      priority: "later",
    },
  ];
}

export async function runClinicSiteWorkflow(
  plan: EvaluationPlan,
  retriever = new LocalEvidenceRetriever(),
): Promise<ClinicSiteWorkflowResult> {
  if (plan.capabilityId !== "clinic_site_evaluation") {
    return clinicSiteWorkflowResultSchema.parse({
      status: "blocked",
      interpretation: plan.intent.conciseInterpretation,
      evidenceBundles: [],
      supportedFindings: [],
      contraryEvidence: [],
      missingEvidence: ["The question did not route to clinic site evaluation."],
      warnings: [],
      nextResearchSteps: researchSteps(),
    });
  }

  const unresolvedPlaces = plan.geographyResolution.places.filter((place) => place.status !== "resolved");
  if (unresolvedPlaces.length) {
    return clinicSiteWorkflowResultSchema.parse({
      status: "blocked",
      interpretation: plan.intent.conciseInterpretation,
      evidenceBundles: [],
      supportedFindings: [],
      contraryEvidence: [],
      missingEvidence: [
        `Resolve these clinic markets before retrieval: ${unresolvedPlaces.map((place) => place.requestedName).join(", ")}.`,
      ],
      warnings: [plan.geographyResolution.message],
      nextResearchSteps: researchSteps(),
    });
  }

  const places = plan.geographyResolution.places.filter(
    (place): place is typeof place & { cbsaCode: string; cbsaName: string } =>
      place.status === "resolved" && Boolean(place.cbsaCode && place.cbsaName),
  );
  if (!places.length) {
    return clinicSiteWorkflowResultSchema.parse({
      status: "blocked",
      interpretation: plan.intent.conciseInterpretation,
      evidenceBundles: [],
      supportedFindings: [],
      contraryEvidence: [],
      missingEvidence: ["Resolve one or more clinic markets before retrieving evidence."],
      warnings: [plan.geographyResolution.message],
      nextResearchSteps: researchSteps(),
    });
  }

  const evidenceBundles = await Promise.all(places.map((place) => retriever.retrieveClinicSiteEvidence({
    cbsaCode: place.cbsaCode,
    cbsaName: place.cbsaName,
    snapshotVersion: SNAPSHOT_VERSION,
    year: null,
  })));
  const available = evidenceBundles.flatMap((bundle) => bundle.results.filter((result) => result.rows.length > 0));
  const missingEvidence = [...new Set(evidenceBundles.flatMap((bundle) => bundle.missingEvidence))];
  const warnings = [...new Set(evidenceBundles.flatMap((bundle) => bundle.warnings))];
  const supportedFindings = available.length
    ? [
        `${available.length} registered evidence query result(s) were retrieved for ${places.map((place) => place.cbsaName).join(" and ")}.`,
        ...evidenceBundles.flatMap((bundle) => bundle.results
          .filter((result) => result.rows.length > 0)
          .map((result) => `${result.query} returned ${result.rows.length} row(s) for ${bundle.request.cbsaName}.`)),
      ]
    : [];
  const contraryEvidence = [
    "Retrieved market and clinic context is descriptive evidence and does not establish demand for a specific property.",
    "No result in this workflow authorizes a lease, opening, spend, outreach, or final site decision.",
  ];

  return clinicSiteWorkflowResultSchema.parse({
    status: available.length ? (missingEvidence.length ? "research_needed" : "complete") : "blocked",
    interpretation: plan.intent.conciseInterpretation,
    evidenceBundles,
    supportedFindings,
    contraryEvidence,
    missingEvidence,
    warnings,
    nextResearchSteps: researchSteps(),
  });
}
