"use client";

import { useMemo, useState } from "react";
import { AskAiPanel } from "@/components/AskAiPanel";
import type { PublicMarketRecord } from "@/lib/data/cbsa-market-context";
import {
  buildMarketComparisonAskAiContext,
  canAddMarketToComparison,
  marketAttractivenessResults,
  type MarketAttractivenessResult,
  type MarketDimensionId,
} from "@/lib/market-attractiveness";
import styles from "./market-comparison-workspace.module.css";

type MarketComparisonWorkspaceProps = {
  activeMarket: PublicMarketRecord | null;
  selectedCodes: readonly string[];
  onAddActiveMarket: () => void;
  onRemoveMarket: (code: string) => void;
};

function dimensionScore(
  result: MarketAttractivenessResult,
  dimensionId: MarketDimensionId,
) {
  return (
    result.subscores.find((subscore) => subscore.dimensionId === dimensionId)
      ?.score ?? null
  );
}

function formatScore(value: number | null) {
  return value === null ? "Missing" : value.toFixed(1);
}

function sensitivityLabel(result: MarketAttractivenessResult) {
  return `${result.sensitivity.classification.replaceAll("-", " ")} · rank range ${result.sensitivity.rankRange} · best ${result.sensitivity.bestRank} · worst ${result.sensitivity.worstRank}`;
}

const comparisonRows: Array<{
  label: string;
  value: (result: MarketAttractivenessResult) => React.ReactNode;
}> = [
  { label: "Overall score", value: (result) => formatScore(result.overallScore) },
  {
    label: "Cohort standing",
    value: (result) =>
      `Rank ${result.cohortRank} · ${result.cohortPercentile.toFixed(1)} percentile`,
  },
  {
    label: "Chewy demand",
    value: (result) => formatScore(dimensionScore(result, "chewy_demand")),
  },
  {
    label: "Market capacity",
    value: (result) => formatScore(dimensionScore(result, "market_capacity")),
  },
  {
    label: "Veterinary opportunity",
    value: (result) =>
      formatScore(dimensionScore(result, "veterinary_opportunity")),
  },
  {
    label: "Clinic engagement",
    value: (result) =>
      formatScore(dimensionScore(result, "chewy_clinic_engagement")),
  },
  { label: "Sensitivity", value: sensitivityLabel },
  {
    label: "Missing inputs",
    value: (result) => result.missingInputs.join(", ") || "None recorded",
  },
  {
    label: "Excluded metrics",
    value: (result) => result.excludedMetrics.join(", ") || "None recorded",
  },
  {
    label: "Warnings",
    value: (result) => (
      <ul>
        {result.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    ),
  },
];

export function MarketComparisonWorkspace({
  activeMarket,
  selectedCodes,
  onAddActiveMarket,
  onRemoveMarket,
}: MarketComparisonWorkspaceProps) {
  const [saveNotice, setSaveNotice] = useState("");
  const resultByCode = useMemo(
    () =>
      new Map(
        marketAttractivenessResults
          .filter((result) => result.cbsaCode)
          .map((result) => [result.cbsaCode!, result]),
      ),
    [],
  );
  const activeResult = activeMarket
    ? resultByCode.get(activeMarket.cbsa_code) ?? null
    : null;
  const selectedResults = selectedCodes
    .map((code) => resultByCode.get(code))
    .filter((result): result is MarketAttractivenessResult => Boolean(result));
  const addEligibility = canAddMarketToComparison(
    activeResult,
    selectedResults,
  );
  const askAiContext = buildMarketComparisonAskAiContext(selectedResults);

  return (
    <section
      className={styles.workspace}
      id="market-comparison"
      aria-labelledby="market-comparison-title"
    >
      <header className={styles.header}>
        <div>
          <p>Analyst-selected comparison</p>
          <h2 id="market-comparison-title">Compare markets</h2>
          <span>
            Compare two to five markets from one scoring cohort. Selection order
            is preserved and no winner is produced.
          </span>
        </div>
        <button
          className={styles.save}
          type="button"
          onClick={() =>
            setSaveNotice(
              "Saving comparisons is not available in this prototype. Nothing was stored.",
            )
          }
        >
          Save comparison
        </button>
      </header>

      {saveNotice ? (
        <p className={styles.saveNotice} role="status">
          {saveNotice}
        </p>
      ) : null}

      <section className={styles.active} aria-live="polite">
        <div>
          <span>Active market</span>
          <strong>{activeMarket?.cbsa_name ?? "Select a market"}</strong>
          <small>
            {activeMarket
              ? `CBSA ${activeMarket.cbsa_code}`
              : "Choose a boundary or market-list row."}
          </small>
        </div>
        {activeMarket ? (
          <div className={styles.activeScore}>
            <span>Synthetic score</span>
            <strong>
              {activeResult ? formatScore(activeResult.overallScore) : "Not scored"}
            </strong>
            <small>
              {activeResult
                ? `${activeResult.cohort} · rank ${activeResult.cohortRank}`
                : "No exact scored CBSA result"}
            </small>
          </div>
        ) : null}
        <button
          type="button"
          disabled={!addEligibility.allowed}
          onClick={onAddActiveMarket}
        >
          Add to comparison
        </button>
        {!addEligibility.allowed && activeMarket ? (
          <p>{addEligibility.reason}</p>
        ) : null}
      </section>

      <div className={styles.selection}>
        <div>
          <strong>{selectedResults.length} of 5 selected</strong>
          <span>
            {selectedResults[0]
              ? `${selectedResults[0].cohort} cohort`
              : "Add markets to begin"}
          </span>
        </div>
        <div className={styles.chips}>
          {selectedResults.map((result, index) => (
            <span key={result.cbsaCode}>
              {index + 1}. {result.marketName}
              <button
                type="button"
                aria-label={`Remove ${result.marketName} from comparison`}
                onClick={() => onRemoveMarket(result.cbsaCode!)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {selectedResults.length >= 1 ? (
        <>
          {selectedResults.length >= 2 ? (
          <div className={styles.tableWrap}>
            <table>
              <caption>
                Synthetic deterministic results in analyst selection order.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Comparison field</th>
                  {selectedResults.map((result) => (
                    <th scope="col" key={result.cbsaCode}>
                      {result.marketName}
                      <span>CBSA {result.cbsaCode}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {selectedResults.map((result) => (
                      <td key={result.cbsaCode}>{row.value(result)}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Versions and evidence</th>
                  {selectedResults.map((result) => (
                    <td key={result.cbsaCode}>
                      <strong>{result.evidenceStatus}</strong>
                      <span>{result.allowedUse}</span>
                      <small>Data {result.dataVersion}</small>
                      <small>Configuration {result.configurationVersion}</small>
                      <small>Calculation {result.calculationVersion}</small>
                      <small>Normalization {result.normalizationVersion}</small>
                      <small>Fingerprint {result.configurationFingerprint}</small>
                      <small>
                        CBSA link {result.cbsaJoinSourceId} · {result.cbsaJoinVintage}
                      </small>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          ) : (
            <div className={styles.empty}>
              Add another scored market from the same cohort to see a side-by-side
              comparison.
            </div>
          )}

          <AskAiPanel
            key={askAiContext?.id}
            context={askAiContext}
            emptyTitle="Ask about this comparison"
            emptyMessage="Add a scored market to ask AI about it."
            className={styles.askAi}
          />
        </>
      ) : (
        <div className={styles.empty}>
          Add a scored market to ask AI about its supplied evidence. Add a second
          market from the same cohort for a side-by-side comparison.
        </div>
      )}

      <footer>
        Synthetic screening only. A higher score is not a recommendation to
        enter a market, select a site, sign a lease, or open a clinic.
      </footer>
    </section>
  );
}
