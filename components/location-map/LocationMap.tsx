"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { LocationCategory, LocationDisplay } from "@/lib/locations";
import styles from "./location-map.module.css";

export interface LocationMapProps {
  /** Locations in the active category. */
  locations: readonly LocationDisplay[];
  /** Category used to label and style the marker set. */
  activeCategory: LocationCategory;
  /** Stable site ID shared with the synchronized list. */
  selectedSiteId: string | null;
  /** Receives the full display record selected from a marker. */
  onSelect: (location: LocationDisplay) => void;
}

function markerLabel(location: LocationDisplay) {
  const score = location.score
    ? ` Score ${location.score.value} out of ${location.score.max_value}.`
    : "";
  const synthetic = location.is_synthetic
    ? " Synthetic location."
    : location.map_position?.is_synthetic
      ? " Synthetic map placement."
      : "";

  return `${location.site_name}, ${location.market}. ${location.location_status}.${score}${synthetic}`;
}

export function LocationMap({
  locations,
  activeCategory,
  selectedSiteId,
  onSelect,
}: LocationMapProps) {
  const positionedLocations = locations.filter(
    (location) => location.map_position !== null,
  );
  const missingPositions = locations.length - positionedLocations.length;

  return (
    <section
      className={styles.mapCard}
      aria-label={`United States map showing ${activeCategory} locations`}
    >
      <div className={styles.mapHeading}>
        <div>
          <h3>National footprint</h3>
          <p>Approximate display positions only</p>
        </div>
        <span className={`${styles.legendDot} ${styles[activeCategory]}`}>
          <span aria-hidden="true" />
          {activeCategory}
        </span>
      </div>

      <div className={styles.mapCanvas}>
        <Image
          className={styles.mapImage}
          src="/us-map.svg"
          alt="Map of the contiguous United States"
          fill
          priority
          sizes="(max-width: 800px) 100vw, 65vw"
        />
        {positionedLocations.map((location) => {
          const position = location.map_position!;
          const isSelected = selectedSiteId === location.site_id;
          const markerStyle = {
            "--marker-x": `${position.x_percent}%`,
            "--marker-y": `${position.y_percent}%`,
          } as CSSProperties;

          return (
            <button
              key={location.site_id}
              className={`${styles.marker} ${styles[activeCategory]} ${
                isSelected ? styles.selectedMarker : ""
              }`}
              style={markerStyle}
              type="button"
              aria-label={markerLabel(location)}
              aria-pressed={isSelected}
              onClick={() => onSelect(location)}
            >
              {location.score ? (
                <span aria-hidden="true">{location.score.value}</span>
              ) : (
                <span className={styles.markerDot} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <p className={styles.mapNote}>
        Marker placement is synthetic unless an adapter explicitly provides an
        approved position. No customer coordinates are shown.
      </p>
      {missingPositions > 0 ? (
        <p className={styles.missingPosition} role="status">
          {missingPositions} {missingPositions === 1 ? "location has" : "locations have"} no
          available map position and remains available in the list.
        </p>
      ) : null}
    </section>
  );
}
