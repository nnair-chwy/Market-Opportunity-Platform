"use client";

import { useRef, type KeyboardEvent } from "react";
import type { LocationCategory } from "@/lib/locations";
import styles from "./location-map.module.css";

const categories: readonly LocationCategory[] = [
  "current",
  "potential",
  "evaluated",
];

const labels: Record<LocationCategory, string> = {
  current: "Current locations",
  potential: "Potential locations",
  evaluated: "Evaluated locations",
};

export interface LocationTabsProps {
  /** Category represented by the active tab and panel. */
  activeCategory: LocationCategory;
  /** Visible item counts for each category. */
  counts: Readonly<Record<LocationCategory, number>>;
  /** Receives keyboard or pointer-driven category changes. */
  onCategoryChange: (category: LocationCategory) => void;
  /** ID of the tab panel controlled by these tabs. */
  panelId: string;
}

export function LocationTabs({
  activeCategory,
  counts,
  onCategoryChange,
  panelId,
}: LocationTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % categories.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + categories.length) % categories.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = categories.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextCategory = categories[nextIndex];
    onCategoryChange(nextCategory);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={styles.tabs}
      role="tablist"
      aria-label="Location categories"
    >
      {categories.map((category, index) => {
        const isActive = activeCategory === category;
        return (
          <button
            key={category}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`location-tab-${category}`}
            className={isActive ? styles.activeTab : styles.tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onCategoryChange(category)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{labels[category]}</span>
            <span className={styles.count} aria-label={`${counts[category]} items`}>
              {counts[category]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
