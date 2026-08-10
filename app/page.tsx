import cvcPerformanceCsv from "@/data/fixtures/cvc-performance/aggregate-performance.synthetic.csv?raw";
import { EvaluationWorkspace } from "@/components/evaluation-workspace";
import { buildEvaluationDemos } from "@/lib/evaluation/demo";
import { VERIFIED_EVALUATION_LIBRARY } from "@/lib/evaluation";

export default function Home() {
  const demos = buildEvaluationDemos(cvcPerformanceCsv);
  return <EvaluationWorkspace {...demos} library={VERIFIED_EVALUATION_LIBRARY} />;
}
