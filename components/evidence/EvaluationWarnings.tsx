import type { EvaluationWarning } from "@/lib/evidence";
import styles from "./evidence.module.css";

export interface EvaluationWarningsProps {
  warnings?: readonly EvaluationWarning[] | null;
  heading?: string;
}

export function EvaluationWarnings({
  warnings,
  heading = "Evaluation warnings",
}: EvaluationWarningsProps) {
  const items = warnings ?? [];

  return (
    <section
      className={styles.panel}
      aria-labelledby="evaluation-warnings-heading"
    >
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Review before use</p>
          <h2 id="evaluation-warnings-heading">{heading}</h2>
        </div>
        <span className={styles.count}>{items.length}</span>
      </div>

      {items.length ? (
        <ul className={styles.warningList}>
          {items.map((warning) => (
            <li
              className={styles[`severity${warning.severity}`]}
              key={warning.warningId}
            >
              <div>
                <span className={styles.severity}>{warning.severity}</span>
                <strong>
                  {warning.sensitivity === "restricted"
                    ? "Restricted evaluation warning"
                    : warning.title}
                </strong>
              </div>
              {warning.sensitivity === "restricted" ? (
                <p>Details are hidden because this warning is restricted.</p>
              ) : (
                <>
                  <p>{warning.detail}</p>
                  {warning.metricIds?.length ? (
                    <small>Metrics: {warning.metricIds.join(", ")}</small>
                  ) : null}
                  {warning.sourceIds?.length ? (
                    <small>Sources: {warning.sourceIds.join(", ")}</small>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>No evaluation warnings were supplied.</p>
      )}
    </section>
  );
}
