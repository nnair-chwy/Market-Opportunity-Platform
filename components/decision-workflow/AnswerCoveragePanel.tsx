import type {
  ComposedFinalAnswer,
  InvestigationCoverageReport,
} from "@/lib/planning";
import styles from "./answer-coverage-panel.module.css";

export function AnswerCoveragePanel({
  coverage,
  answer,
}: {
  coverage: InvestigationCoverageReport;
  answer: ComposedFinalAnswer;
}) {
  const coveragePercent = coverage.requiredCount
    ? Math.round(coverage.coveredRequiredCount / coverage.requiredCount * 100)
    : 0;
  return (
    <section className={styles.panel} aria-labelledby="answer-coverage-title" data-coverage-status={coverage.overallStatus}>
      <header className={styles.header}>
        <div>
          <span>Answer contract check</span>
          <h2 id="answer-coverage-title">What the investigation can actually answer</h2>
          <p>{coverage.permittedConclusion}</p>
        </div>
        <div className={styles.score} aria-label={`${coverage.coveredRequiredCount} of ${coverage.requiredCount} required answer items covered`}>
          <strong>{coveragePercent}%</strong>
          <small>{coverage.coveredRequiredCount} of {coverage.requiredCount} covered</small>
        </div>
      </header>

      <div className={styles.statusLine}>
        <span data-status={coverage.overallStatus}>{coverage.overallStatus}</span>
        <p>Unsupported promises stay visible and cannot be silently converted into conclusions.</p>
      </div>

      <details className={styles.coverageDetails}>
        <summary>See section and domain coverage</summary>
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

      <details className={styles.answerDetails} open>
        <summary>Read the contract-complete draft answer</summary>
        <p className={styles.disclaimer}>{answer.disclaimer}</p>
        <div className={styles.answerSections}>
          {answer.sections.map((section) => (
            <article key={section.sectionId} data-status={section.supportStatus}>
              <header>
                <strong>{section.label}</strong>
                <span>{section.supportStatus}</span>
              </header>
              {section.content.split("\n").map((paragraph, index) => <p key={`${section.sectionId}-${index}`}>{paragraph}</p>)}
              {section.sourceIds.length ? <small>Sources: {section.sourceIds.join(" · ")}</small> : null}
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
