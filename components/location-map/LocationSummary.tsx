import type { LocationDisplay } from "@/lib/locations";
import styles from "./location-map.module.css";

export interface LocationSummaryProps {
  /** Selected provider-neutral display record, or null for no selection. */
  location: LocationDisplay | null;
}

export function LocationSummary({ location }: LocationSummaryProps) {
  if (!location) {
    return (
      <section className={styles.summary} aria-live="polite">
        <strong>No location selected</strong>
        <p>Select a location to inspect its display metadata.</p>
      </section>
    );
  }

  return (
    <section
      className={styles.summary}
      aria-live="polite"
      aria-label={`Selected location: ${location.site_name}`}
    >
      <div className={styles.summaryHeading}>
        <div>
          <p className={styles.eyebrow}>Selected location</p>
          <h3>{location.site_name}</h3>
          <p>
            {location.market}
            {location.region_code ? `, ${location.region_code}` : ""}
          </p>
        </div>
        {location.score ? (
          <div className={styles.summaryScore}>
            <strong>{location.score.value}</strong>
            <span>of {location.score.max_value}</span>
          </div>
        ) : (
          <span className={styles.noScore}>No score</span>
        )}
      </div>

      <dl className={styles.metadata}>
        <div>
          <dt>Stable site ID</dt>
          <dd>{location.site_id}</dd>
        </div>
        <div>
          <dt>Location status</dt>
          <dd>{location.location_status}</dd>
        </div>
        <div>
          <dt>Evidence status</dt>
          <dd>{location.evidence_status}</dd>
        </div>
        <div>
          <dt>Evaluation state</dt>
          <dd>{location.evaluation_state}</dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd>
            {location.source_ids.length
              ? location.source_ids.join(", ")
              : "Unknown"}
          </dd>
        </div>
      </dl>

      {location.is_synthetic ? (
        <p className={styles.syntheticCallout}>
          Synthetic candidate location. It is not sourced from the unconfirmed
          candidate pipeline.
        </p>
      ) : null}

      <ul className={styles.notes}>
        {location.data_notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}
