import type { MissingInformationItem } from "@/lib/evidence";
import styles from "./evidence.module.css";

export interface MissingInformationChecklistProps {
  items?: readonly MissingInformationItem[] | null;
  heading?: string;
}

export function MissingInformationChecklist({
  items,
  heading = "Missing information",
}: MissingInformationChecklistProps) {
  const checklist = items ?? [];

  return (
    <section
      className={styles.panel}
      aria-labelledby="missing-information-heading"
    >
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Diligence checklist</p>
          <h2 id="missing-information-heading">{heading}</h2>
        </div>
        <span className={styles.count}>{checklist.length}</span>
      </div>

      {checklist.length ? (
        <ul className={styles.checklist}>
          {checklist.map((item) => (
            <li key={item.itemId}>
              <span
                className={`${styles.checkIcon} ${styles[item.status]}`}
                aria-hidden="true"
              >
                {item.status === "resolved" ? "✓" : "!"}
              </span>
              <div>
                <div className={styles.checklistTitle}>
                  <strong>
                    {item.sensitivity === "restricted"
                      ? "Restricted information requirement"
                      : item.label}
                  </strong>
                  <span className={styles.disposition}>{item.status}</span>
                </div>
                {item.sensitivity === "restricted" ? (
                  <p>Details are hidden because this item is restricted.</p>
                ) : (
                  <>
                    {item.detail ? <p>{item.detail}</p> : null}
                    {item.sourceId ? (
                      <small>Expected source: {item.sourceId}</small>
                    ) : (
                      <small>Expected source: Unknown</small>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>
          No missing-information items were supplied. This does not confirm
          completeness.
        </p>
      )}
    </section>
  );
}
