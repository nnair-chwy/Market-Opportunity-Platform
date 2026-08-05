"use client";

import type { LocationDisplay } from "@/lib/locations";
import styles from "./location-map.module.css";

export interface LocationListProps {
  /** Locations in the active category. */
  locations: readonly LocationDisplay[];
  /** Stable site ID shared with the synchronized map. */
  selectedSiteId: string | null;
  /** Receives the full display record selected from a row. */
  onSelect: (location: LocationDisplay) => void;
}

export function LocationList({
  locations,
  selectedSiteId,
  onSelect,
}: LocationListProps) {
  if (locations.length === 0) {
    return (
      <section className={styles.emptyState} aria-label="Location list">
        <strong>No locations in this category</strong>
        <p>The active provider returned an empty location array.</p>
      </section>
    );
  }

  return (
    <section className={styles.listCard} aria-label="Synchronized location list">
      <div className={styles.listHeading}>
        <div>
          <h3>Locations</h3>
          <p>Select a row or map marker</p>
        </div>
        <span>{locations.length}</span>
      </div>
      <ul className={styles.locationList}>
        {locations.map((location) => {
          const isSelected = selectedSiteId === location.site_id;
          const region = location.region_code ?? "Region unknown";

          return (
            <li key={location.site_id}>
              <button
                className={isSelected ? styles.selectedRow : styles.locationRow}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(location)}
              >
                <span className={styles.rowTopline}>
                  <span>
                    <strong>{location.site_name}</strong>
                    <small>
                      {location.market}, {region}
                    </small>
                  </span>
                  {location.score ? (
                    <span
                      className={styles.score}
                      aria-label={`Score ${location.score.value} out of ${location.score.max_value}`}
                    >
                      {location.score.value}
                    </span>
                  ) : null}
                </span>
                <span className={styles.badges}>
                  {location.is_synthetic ? (
                    <span className={styles.syntheticBadge}>
                      Synthetic location
                    </span>
                  ) : location.map_position?.is_synthetic ? (
                    <span className={styles.positionBadge}>
                      Synthetic map position
                    </span>
                  ) : null}
                  <span className={styles.statusBadge}>
                    {location.location_status}
                  </span>
                  <span
                    className={`${styles.evidenceBadge} ${
                      styles[`evidence${location.evidence_status}`]
                    }`}
                  >
                    {location.evidence_status}
                  </span>
                  <span className={styles.evaluationBadge}>
                    {location.evaluation_state}
                  </span>
                  {location.map_position === null ? (
                    <span className={styles.unknownBadge}>
                      Map position unavailable
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
