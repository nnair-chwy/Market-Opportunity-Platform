"use client";

import { useMemo, useState } from "react";
import {
  comparisonWarnings,
  esriDemoManifest,
  esriTradeAreaProfiles,
  type SiteTradeAreaProfile,
  type TradeAreaContextObservation,
  type TradeAreaProfileSection,
  type TradeAreaProfileVariant,
} from "@/lib/esri-demo";
import styles from "./market-trade-area-profile.module.css";

type MarketTradeAreaProfileProps = {
  marketCode: string;
  onOpenReadiness: (siteId: string) => void;
  onOpenLocations: (marketCode: string) => void;
};

const sectionLabels: Record<TradeAreaProfileSection, string> = {
  market_household: "Market and household context",
  chewy_demand: "Chewy demand context",
  veterinary_supply: "Veterinary supply context",
};

function valueLabel(observation: TradeAreaContextObservation) {
  if (observation.raw_value === null) return "Unavailable";
  if (observation.unit === "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(observation.raw_value);
  }
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits:
      observation.unit === "percent" || observation.unit === "ratio" ? 1 : 0,
  }).format(observation.raw_value);
  if (observation.unit === "percent") return `${formatted}%`;
  if (observation.unit === "square_miles") return `${formatted} sq mi`;
  if (observation.unit === "index") return `${formatted} index`;
  if (observation.unit === "ratio") return `${formatted} ratio`;
  if (observation.unit === null) return `${formatted} · unit unknown`;
  return formatted;
}

function comparisonKey(siteId: string, tradeAreaId: string) {
  return `${siteId}::${tradeAreaId}`;
}

function variantLabel(
  profile: SiteTradeAreaProfile,
  variant: TradeAreaProfileVariant,
) {
  const origin = variant.is_synthetic ? "Synthetic" : "Supplied";
  return `${profile.site_name} · ${origin} · ${variant.trade_area_id}`;
}

function DiligenceSummary({ title }: { title: string }) {
  return (
    <summary className={styles.dropdownSummary}>
      <div>
        <p className={styles.eyebrow}>Optional site diligence</p>
        <h2 id="trade-area-title">{title}</h2>
      </div>
      <span className={styles.dropdownChevron} aria-hidden="true">
        ▾
      </span>
    </summary>
  );
}

export function MarketTradeAreaProfile({
  marketCode,
  onOpenReadiness,
  onOpenLocations,
}: MarketTradeAreaProfileProps) {
  const profiles = useMemo(
    () =>
      esriTradeAreaProfiles.filter(
        (profile) => profile.cbsa_id === marketCode,
      ),
    [marketCode],
  );
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedTradeAreaId, setSelectedTradeAreaId] = useState("");
  const [comparisonKeys, setComparisonKeys] = useState<string[]>([]);
  const [comparisonCandidate, setComparisonCandidate] = useState("");
  const selectedProfile =
    profiles.find((profile) => profile.site_id === selectedSiteId) ??
    profiles[0] ??
    null;
  const selectedVariant =
    selectedProfile?.variants.find(
      (variant) => variant.trade_area_id === selectedTradeAreaId,
    ) ??
    selectedProfile?.variants[0] ??
    null;
  const availableVariants = profiles.flatMap((profile) =>
    profile.variants.map((variant) => ({ profile, variant })),
  );
  const comparedVariants = comparisonKeys
    .map((key) =>
      availableVariants.find(
        ({ profile, variant }) =>
          comparisonKey(profile.site_id, variant.trade_area_id) === key,
      ),
    )
    .filter(
      (
        value,
      ): value is {
        profile: SiteTradeAreaProfile;
        variant: TradeAreaProfileVariant;
      } => Boolean(value),
    );
  const comparisonIssues = comparisonWarnings(
    comparedVariants.map(({ variant }) => variant),
  );
  const comparisonMetrics = [
    "population",
    "households",
    "households_with_pets",
    "median_income",
    "veterinary_clinic_count",
    "pet_households_per_clinic",
  ];

  if (!marketCode) {
    return (
      <details
        className={`${styles.empty} ${styles.compactEmpty}`}
      >
        <DiligenceSummary title="Linked site evidence" />
        <div className={`${styles.dropdownContent} ${styles.compactContent}`}>
          <p>
            Select a market to check whether linked site-level trade-area records
            are available. This evidence is separate from public CBSA context and
            is never used for market scoring.
          </p>
        </div>
      </details>
    );
  }

  if (!selectedProfile || !selectedVariant) {
    return (
      <details
        className={`${styles.empty} ${styles.compactEmpty}`}
      >
        <DiligenceSummary title="Linked site evidence unavailable for this market" />
        <div className={`${styles.dropdownContent} ${styles.compactContent}`}>
          <p>
            No approved Esri site relationship is available for CBSA {marketCode}.
            Continue using the public market comparison above. This is a coverage
            gap in the prototype, not an application error.
          </p>
        </div>
      </details>
    );
  }

  const sectionObservations = (section: TradeAreaProfileSection) =>
    selectedVariant.observations.filter(
      (observation) => observation.section === section,
    );
  const selectedKey = comparisonKey(
    selectedProfile.site_id,
    selectedVariant.trade_area_id,
  );

  return (
    <details className={styles.profile}>
      <DiligenceSummary title="Linked site evidence" />
      <div className={styles.dropdownContent}>
      <header className={styles.header}>
        <div>
          <p>
            Review linked site-level trade-area records after comparing markets.
            This evidence is separate from Public CBSA context and is not part
            of the market score. No trade-area geometry is drawn because its
            method and boundary are unknown.
          </p>
        </div>
        <div className={styles.nonScored}>
          <strong>Not used for scoring</strong>
          <span>{esriDemoManifest.snapshot_id}</span>
        </div>
      </header>

      <div className={styles.boundary}>
        <strong>Evidence boundary</strong>
        <span>
          CBSA {marketCode} is a public statistical area. The local values below
          come from a linked Esri record with an unknown trade-area method and
          must not be interpreted as the CBSA, a drive time, a radius, or a
          service area.
        </span>
      </div>

      <div className={styles.controls}>
        <label>
          <span>Linked site</span>
          <select
            value={selectedProfile.site_id}
            onChange={(event) => {
              setSelectedSiteId(event.target.value);
              setSelectedTradeAreaId("");
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.site_id} value={profile.site_id}>
                {profile.site_name} · {profile.brand}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Trade-area variant</span>
          <select
            value={selectedVariant.trade_area_id}
            onChange={(event) => setSelectedTradeAreaId(event.target.value)}
          >
            {selectedProfile.variants.map((variant, index) => (
              <option key={variant.trade_area_id} value={variant.trade_area_id}>
                Variant {index + 1} ·{" "}
                {variant.is_synthetic ? "Synthetic" : "Supplied"} · role{" "}
                {variant.trade_area_role}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.actions}>
          <button onClick={() => onOpenReadiness(selectedProfile.site_id)}>
            Open readiness record
          </button>
          <button onClick={() => onOpenLocations(marketCode)}>
            Open Locations for market
          </button>
        </div>
      </div>

      <div className={styles.identity}>
        <div>
          <span>Selected site</span>
          <strong>{selectedProfile.site_name}</strong>
          <small>
            {selectedProfile.brand} · {selectedProfile.market_name ?? "Unknown market"}
            {selectedProfile.state ? `, ${selectedProfile.state}` : ""}
          </small>
        </div>
        <div>
          <span>Evidence origin</span>
          <strong>
            {selectedVariant.is_synthetic
              ? "Synthetic demonstration trade area"
              : "Esri-reported local trade-area evidence"}
          </strong>
          <small>
            {selectedVariant.evidence_status} ·{" "}
            {selectedVariant.relationship_review_state.replaceAll("_", " ")}
          </small>
        </div>
        <div>
          <span>Known limitations</span>
          <strong>Method and role unconfirmed</strong>
          <small>Observation date unknown for supplied records</small>
        </div>
      </div>

      <div className={styles.warningList} role="status">
        {selectedVariant.warnings.map((warning) => (
          <span key={warning}>! {warning}</span>
        ))}
      </div>

      {(
        [
          "market_household",
          "chewy_demand",
          "veterinary_supply",
        ] as TradeAreaProfileSection[]
      ).map((section) => (
        <section className={styles.metricSection} key={section}>
          <div className={styles.sectionHeading}>
            <div>
              <h3>{sectionLabels[section]}</h3>
              <p>
                {section === "chewy_demand"
                  ? "Internal aggregate evidence. Values are descriptive and direction is not approved."
                  : "Raw supplied or synthetic values with no favorable direction or weighting."}
              </p>
            </div>
            <span>
              {section === "chewy_demand" ? "Internal aggregate" : "Non-scored"}
            </span>
          </div>
          <div className={styles.metricGrid}>
            {sectionObservations(section).map((observation) => (
              <article
                className={
                  observation.raw_value === null
                    ? styles.missingMetric
                    : styles.metric
                }
                key={observation.metric_id}
              >
                <span>{observation.display_label}</span>
                <strong>{valueLabel(observation)}</strong>
                <small>
                  {observation.evidence_status} · {observation.quality_status}
                </small>
                <details>
                  <summary>Provenance and quality</summary>
                  <dl>
                    <div>
                      <dt>Source</dt>
                      <dd>{observation.source_id}</dd>
                    </div>
                    <div>
                      <dt>Observed</dt>
                      <dd>{observation.observed_at ?? "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Received</dt>
                      <dd>{observation.received_at}</dd>
                    </div>
                    <div>
                      <dt>Geography</dt>
                      <dd>
                        Trade area · {observation.geography_method ?? "method unknown"}
                      </dd>
                    </div>
                    <div>
                      <dt>Sensitivity</dt>
                      <dd>{observation.sensitivity}</dd>
                    </div>
                    <div>
                      <dt>Scoring eligibility</dt>
                      <dd>None</dd>
                    </div>
                  </dl>
                  {observation.warnings.length ? (
                    <ul>
                      {observation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.unavailable}>
        <div className={styles.sectionHeading}>
          <div>
            <h3>Unavailable or excluded context</h3>
            <p>
              Sparse fields remain out of the profile until definitions and
              direction are approved.
            </p>
          </div>
        </div>
        <ul>
          {selectedProfile.unavailable_evidence.map((item) => (
            <li key={item.field_group}>
              <strong>{item.field_group}</strong>
              <span>{item.reason}</span>
              <small>Expected source or owner: {item.expected_source_or_owner}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.comparison}>
        <div className={styles.sectionHeading}>
          <div>
            <h3>Descriptive trade-area comparison</h3>
            <p>
              Compare up to three raw profiles. No composite, sorting, winner,
              or recommendation is calculated.
            </p>
          </div>
          <span>{comparedVariants.length} of 3 selected</span>
        </div>
        <div className={styles.comparisonControls}>
          <label>
            <span>Profile to compare</span>
            <select
              value={comparisonCandidate}
              onChange={(event) => setComparisonCandidate(event.target.value)}
            >
              <option value="">Choose a profile</option>
              {availableVariants.map(({ profile, variant }) => {
                const key = comparisonKey(profile.site_id, variant.trade_area_id);
                return (
                  <option key={key} value={key}>
                    {variantLabel(profile, variant)}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            disabled={
              !comparisonCandidate ||
              comparisonKeys.includes(comparisonCandidate) ||
              comparisonKeys.length >= 3
            }
            onClick={() => {
              setComparisonKeys((current) => [
                ...current,
                comparisonCandidate,
              ]);
              setComparisonCandidate("");
            }}
          >
            Add to comparison
          </button>
          <button
            disabled={
              comparisonKeys.includes(selectedKey) ||
              comparisonKeys.length >= 3
            }
            onClick={() =>
              setComparisonKeys((current) => [...current, selectedKey])
            }
          >
            Add selected variant
          </button>
        </div>
        {comparisonIssues.length ? (
          <div className={styles.comparisonWarnings} role="status">
            {comparisonIssues.map((warning) => (
              <span key={warning}>! {warning}</span>
            ))}
          </div>
        ) : null}
        {comparedVariants.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Raw metric</th>
                  {comparedVariants.map(({ profile, variant }) => (
                    <th
                      key={comparisonKey(
                        profile.site_id,
                        variant.trade_area_id,
                      )}
                      scope="col"
                    >
                      {profile.site_name}
                      <button
                        aria-label={`Remove ${profile.site_name} from comparison`}
                        onClick={() =>
                          setComparisonKeys((current) =>
                            current.filter(
                              (key) =>
                                key !==
                                comparisonKey(
                                  profile.site_id,
                                  variant.trade_area_id,
                                ),
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonMetrics.map((metricId) => {
                  const label =
                    comparedVariants
                      .flatMap(({ variant }) => variant.observations)
                      .find((observation) => observation.metric_id === metricId)
                      ?.display_label ?? metricId.replaceAll("_", " ");
                  return (
                    <tr key={metricId}>
                      <th scope="row">{label}</th>
                      {comparedVariants.map(({ profile, variant }) => {
                        const observation = variant.observations.find(
                          (item) => item.metric_id === metricId,
                        );
                        return (
                          <td
                            key={comparisonKey(
                              profile.site_id,
                              variant.trade_area_id,
                            )}
                          >
                            {observation ? valueLabel(observation) : "Unavailable"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.comparisonEmpty}>
            Add two or three profiles to inspect raw values and comparability
            warnings.
          </p>
        )}
      </section>
      </div>
    </details>
  );
}
