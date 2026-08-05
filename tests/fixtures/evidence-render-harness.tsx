import {
  EvidenceSummaryPanel,
  EvaluationWarnings,
  MetricDetailPanel,
  MissingInformationChecklist,
  SourceList,
} from "@/components/evidence";
import { SYNTHETIC_EVIDENCE_RESULT } from "@/lib/evidence";

export function EvidenceRenderHarness() {
  return (
    <main>
      <EvidenceSummaryPanel result={SYNTHETIC_EVIDENCE_RESULT} />
      <SourceList sources={SYNTHETIC_EVIDENCE_RESULT.sources} />
      <MetricDetailPanel
        metrics={SYNTHETIC_EVIDENCE_RESULT.metrics}
        qualitativeEvidence={SYNTHETIC_EVIDENCE_RESULT.qualitativeEvidence}
        sources={SYNTHETIC_EVIDENCE_RESULT.sources}
      />
      <MissingInformationChecklist
        items={SYNTHETIC_EVIDENCE_RESULT.missingInformation}
      />
      <EvaluationWarnings warnings={SYNTHETIC_EVIDENCE_RESULT.warnings} />
    </main>
  );
}
