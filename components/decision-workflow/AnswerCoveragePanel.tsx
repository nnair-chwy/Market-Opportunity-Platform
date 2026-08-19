import type {
  AnswerEvaluationReport,
  ComposedFinalAnswer,
  InvestigationCoverageReport,
} from "@/lib/planning";
import { answerReadinessCopy, supportLabel } from "@/lib/planning/result-language";
import styles from "./answer-coverage-panel.module.css";

export function AnswerCoveragePanel({
  coverage,
  answer,
  evaluation,
}: {
  coverage: InvestigationCoverageReport;
  answer: ComposedFinalAnswer;
  evaluation?: AnswerEvaluationReport;
}) {
  const coveragePercent = coverage.requiredCount
    ? Math.round(coverage.coveredRequiredCount / coverage.requiredCount * 100)
    : 0;
  const readiness = answerReadinessCopy(coverage, evaluation);
  const section = (id: ComposedFinalAnswer["sections"][number]["sectionId"]) => answer.sections.find((item) => item.sectionId === id);
  const decisionSections = [section("direct_answer"), section("evidence_findings"), section("permitted_next_action")].filter(Boolean) as ComposedFinalAnswer["sections"];
  const methodSections = answer.sections.filter((item) => !decisionSections.some((decision) => decision.sectionId === item.sectionId));
  return (
    <section className={styles.panel} aria-labelledby="answer-coverage-title" data-coverage-status={coverage.overallStatus}>
      <header className={styles.header}>
        <div>
          <span>Answer readiness</span>
          <h2 id="answer-coverage-title">{readiness.label}</h2>
          <p>{section("direct_answer")?.content ?? coverage.permittedConclusion}</p>
        </div>
        <div className={styles.score} aria-label={`${coverage.coveredRequiredCount} of ${coverage.requiredCount} required answer items covered`}>
          <strong>{coveragePercent}%</strong>
          <small>{readiness.confidence} confidence</small>
        </div>
      </header>

      <div className={styles.statusLine}>
        <span data-status={coverage.overallStatus}>{readiness.gapCount ? `${readiness.gapCount} validation gap${readiness.gapCount === 1 ? "" : "s"}` : "No open validation gaps"}</span>
        <p>The answer stays within the evidence available today; unresolved gaps remain available under Evidence and method.</p>
      </div>

      <div className={styles.answerSections} aria-label="Decision-facing answer">
        {decisionSections.map((answerSection) => (
          <article key={answerSection.sectionId} data-status={answerSection.supportStatus}>
            <header>
              <strong>{answerSection.sectionId === "direct_answer" ? "Answer" : answerSection.sectionId === "evidence_findings" ? "Findings and why they matter" : "What to validate next"}</strong>
              <span>{supportLabel(answerSection.supportStatus)}</span>
            </header>
            {answerSection.content.split("\n").map((paragraph, index) => <p key={`${answerSection.sectionId}-decision-${index}`}>{paragraph}</p>)}
          </article>
        ))}
      </div>

      {evaluation ? (
        <details className={styles.coverageDetails}>
          <summary>Evidence and method: goal checks · {evaluation.passedCount} of {evaluation.criterionCount} passed</summary>
          <div className={styles.coverageGrid}>
            <section>
              <strong>Checks against the question</strong>
              <ul>
                {evaluation.criteria.map((criterion) => (
                  <li key={criterion.criterionId} data-status={criterion.status === "pass" ? "covered" : criterion.status === "partial" ? "unsupported" : "blocked"}>
                    <span>{criterion.label}</span>
                    <b>{criterion.status}</b>
                    <small>{criterion.explanation}</small>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <strong>What to validate next</strong>
              <p>{evaluation.nextPass.question}</p>
              <small>{evaluation.nextPass.completionRule}</small>
            </section>
          </div>
        </details>
      ) : null}

      <details className={styles.coverageDetails}>
        <summary>Evidence and method: answer coverage</summary>
        <div className={styles.coverageGrid}>
          <section>
            <strong>Answer sections</strong>
            <ul>
              {coverage.sectionCoverage.map((item) => (
                <li key={item.itemId} data-status={item.status}>
                  <span>{item.label}</span>
                  <b>{item.status.replaceAll("_", " ")}</b>
                  <small>{item.explanation}</small>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <strong>Domain requirements</strong>
            <ul>
              {coverage.domainCoverage.map((item) => (
                <li key={item.itemId} data-status={item.status}>
                  <span>{item.label}</span>
                  <b>{item.status.replaceAll("_", " ")}</b>
                  <small>{item.explanation}</small>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </details>

      <details className={styles.answerDetails}>
        <summary>Evidence and method: sources, limitations, and versions</summary>
        <p className={styles.disclaimer}>{answer.disclaimer}</p>
        <div className={styles.answerSections}>
          {methodSections.map((answerSection) => (
            <article key={answerSection.sectionId} data-status={answerSection.supportStatus}>
              <header>
                <strong>{answerSection.label}</strong>
                <span>{supportLabel(answerSection.supportStatus)}</span>
              </header>
              {answerSection.content.split("\n").map((paragraph, index) => <p key={`${answerSection.sectionId}-${index}`}>{paragraph}</p>)}
              {answerSection.sourceIds.length ? <small>Sources: {answerSection.sourceIds.join(" · ")}</small> : null}
            </article>
          ))}
          <article>
            <header><strong>Source links for decision-facing sections</strong></header>
            {decisionSections.map((answerSection) => <p key={`${answerSection.sectionId}-sources`}><b>{answerSection.label}:</b> {answerSection.sourceIds.join(" · ") || "No source ID attached"}</p>)}
          </article>
        </div>
      </details>
    </section>
  );
}
