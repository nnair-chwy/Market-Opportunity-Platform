"use client";

import { useId, useMemo, useState } from "react";
import {
  createLocationNavigationState,
  locationsForCategory,
  reduceLocationNavigation,
  type LocationCategory,
  type LocationDataState,
  type LocationDisplay,
  type LocationNavigationEvent,
} from "@/lib/locations";
import { LocationList } from "./LocationList";
import { LocationMap } from "./LocationMap";
import { LocationSummary } from "./LocationSummary";
import { LocationTabs } from "./LocationTabs";
import styles from "./location-map.module.css";

/**
 * Props for the provider-neutral national location navigator.
 *
 * The component never fetches data or calculates scores. Adapters are
 * responsible for producing LocationDisplay records before rendering.
 */
export interface LocationNavigatorProps {
  /** Provider-neutral location records. The component performs no fetching. */
  locations: readonly LocationDisplay[];
  /** Initially active category for the uncontrolled tab state. */
  initialCategory?: LocationCategory;
  /** Initially selected stable site ID, when it belongs to the initial category. */
  initialSelectedSiteId?: string | null;
  /** Provider state used to render ready, loading, unavailable, or partial UI. */
  dataState?: LocationDataState;
  /** Optional user-facing detail for loading, unavailable, or partial data. */
  stateMessage?: string | null;
  /** Optional class name for layout integration. */
  className?: string;
  /** Emits the stable site ID and source display record for every selection. */
  onSelectedSiteChange: (
    siteId: LocationDisplay["site_id"],
    location: LocationDisplay,
  ) => void;
  /** Optionally reports category changes to the integrating page. */
  onCategoryChange?: (category: LocationCategory) => void;
}

export function LocationNavigator({
  locations,
  initialCategory = "potential",
  initialSelectedSiteId,
  dataState = "ready",
  stateMessage,
  className,
  onSelectedSiteChange,
  onCategoryChange,
}: LocationNavigatorProps) {
  const panelId = useId();
  const [navigation, setNavigation] = useState(() =>
    createLocationNavigationState(
      locations,
      initialCategory,
      initialSelectedSiteId,
    ),
  );

  const effectiveNavigation = createLocationNavigationState(
    locations,
    navigation.activeCategory,
    navigation.selectedSiteId,
  );
  const visibleLocations = locationsForCategory(
    locations,
    effectiveNavigation.activeCategory,
  );
  const selectedLocation =
    visibleLocations.find(
      (location) =>
        location.site_id === effectiveNavigation.selectedSiteId,
    ) ?? null;

  const counts = useMemo(
    () => ({
      current: locationsForCategory(locations, "current").length,
      potential: locationsForCategory(locations, "potential").length,
      evaluated: locationsForCategory(locations, "evaluated").length,
    }),
    [locations],
  );

  function applyNavigationEvent(event: LocationNavigationEvent) {
    const next = reduceLocationNavigation(
      effectiveNavigation,
      event,
      locations,
    );
    setNavigation(next);

    if (
      next.selectedSiteId &&
      next.selectedSiteId !== effectiveNavigation.selectedSiteId
    ) {
      const location = locations.find(
        (item) => item.site_id === next.selectedSiteId,
      );
      if (location) onSelectedSiteChange(location.site_id, location);
    }
  }

  function handleCategoryChange(category: LocationCategory) {
    applyNavigationEvent({ type: "change-category", category });
    onCategoryChange?.(category);
  }

  function handleSelect(location: LocationDisplay) {
    applyNavigationEvent({ type: "select-site", siteId: location.site_id });
    if (location.site_id === effectiveNavigation.selectedSiteId) {
      onSelectedSiteChange(location.site_id, location);
    }
  }

  const classes = [styles.navigator, className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-label="National location navigator">
      <LocationTabs
        activeCategory={effectiveNavigation.activeCategory}
        counts={counts}
        onCategoryChange={handleCategoryChange}
        panelId={panelId}
      />

      {dataState === "loading" ? (
        <div className={styles.statePanel} role="status" aria-live="polite">
          <span className={styles.loader} aria-hidden="true" />
          <strong>Loading locations</strong>
          <p>{stateMessage ?? "Waiting for the location provider."}</p>
        </div>
      ) : dataState === "unavailable" ? (
        <div className={styles.statePanel} role="alert">
          <strong>Location data unavailable</strong>
          <p>
            {stateMessage ??
              "The provider could not supply location display data."}
          </p>
        </div>
      ) : (
        <>
          {dataState === "partial" ? (
            <div className={styles.partialBanner} role="status">
              <strong>Partial location data</strong>
              <span>
                {stateMessage ??
                  "Unknown or unavailable fields are shown explicitly."}
              </span>
            </div>
          ) : null}

          <div
            id={panelId}
            className={styles.navigationPanel}
            role="tabpanel"
            aria-labelledby={`location-tab-${effectiveNavigation.activeCategory}`}
            tabIndex={0}
          >
            <LocationMap
              locations={visibleLocations}
              activeCategory={effectiveNavigation.activeCategory}
              selectedSiteId={effectiveNavigation.selectedSiteId}
              onSelect={handleSelect}
            />
            <LocationList
              locations={visibleLocations}
              selectedSiteId={effectiveNavigation.selectedSiteId}
              onSelect={handleSelect}
            />
          </div>
          <LocationSummary location={selectedLocation} />
        </>
      )}
    </section>
  );
}
