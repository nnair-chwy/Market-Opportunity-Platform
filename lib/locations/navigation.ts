import type { LocationCategory, LocationDisplay } from "./types.ts";

export interface LocationNavigationState {
  activeCategory: LocationCategory;
  selectedSiteId: string | null;
}

export type LocationNavigationEvent =
  | { type: "select-site"; siteId: string }
  | { type: "change-category"; category: LocationCategory };

export function locationsForCategory(
  locations: readonly LocationDisplay[],
  category: LocationCategory,
): readonly LocationDisplay[] {
  return locations.filter((location) => location.category === category);
}

export function createLocationNavigationState(
  locations: readonly LocationDisplay[],
  initialCategory: LocationCategory,
  initialSelectedSiteId?: string | null,
): LocationNavigationState {
  const visibleLocations = locationsForCategory(locations, initialCategory);
  const selectedIsVisible = visibleLocations.some(
    (location) => location.site_id === initialSelectedSiteId,
  );

  return {
    activeCategory: initialCategory,
    selectedSiteId: selectedIsVisible
      ? (initialSelectedSiteId ?? null)
      : (visibleLocations[0]?.site_id ?? null),
  };
}

export function reduceLocationNavigation(
  state: LocationNavigationState,
  event: LocationNavigationEvent,
  locations: readonly LocationDisplay[],
): LocationNavigationState {
  if (event.type === "select-site") {
    const selected = locations.find(
      (location) => location.site_id === event.siteId,
    );

    if (!selected || selected.category !== state.activeCategory) {
      return state;
    }

    return { ...state, selectedSiteId: selected.site_id };
  }

  const visibleLocations = locationsForCategory(locations, event.category);
  const existingSelectionIsVisible = visibleLocations.some(
    (location) => location.site_id === state.selectedSiteId,
  );

  return {
    activeCategory: event.category,
    selectedSiteId: existingSelectionIsVisible
      ? state.selectedSiteId
      : (visibleLocations[0]?.site_id ?? null),
  };
}

export function validateLocationDisplays(
  locations: readonly LocationDisplay[],
): readonly string[] {
  const errors: string[] = [];
  const siteIds = new Set<string>();

  for (const location of locations) {
    if (siteIds.has(location.site_id)) {
      errors.push(`Duplicate site_id: ${location.site_id}`);
    }
    siteIds.add(location.site_id);

    if (location.category !== "evaluated" && location.score !== null) {
      errors.push(
        `Only evaluated locations may include a score: ${location.site_id}`,
      );
    }

    if (
      location.map_position &&
      (location.map_position.x_percent < 0 ||
        location.map_position.x_percent > 100 ||
        location.map_position.y_percent < 0 ||
        location.map_position.y_percent > 100)
    ) {
      errors.push(`Map position is outside the display area: ${location.site_id}`);
    }
  }

  return errors;
}
