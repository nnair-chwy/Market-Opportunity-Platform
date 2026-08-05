import fieldCatalogJson from "@/data/sample/esri/2026-07-30/field-catalog.json";
import manifestJson from "@/data/sample/esri/2026-07-30/manifest.json";
import readinessJson from "@/data/sample/esri/2026-07-30/portfolio-readiness.json";
import reviewRecordsJson from "@/data/sample/esri/2026-07-30/rejected-or-review-records.json";
import siteIdentitiesJson from "@/data/sample/esri/2026-07-30/site-identities.json";
import crosswalkJson from "@/data/sample/esri/2026-07-30/site-trade-area-crosswalk.json";
import tradeAreasJson from "@/data/sample/esri/2026-07-30/trade-areas.json";
import { buildTradeAreaProfiles } from "./trade-area-profile";
import {
  buildCandidateEvidenceBrief,
  candidateEvidenceDemoSiteIds,
} from "./candidate-evidence";
import type {
  EsriDemoManifest,
  EsriFieldCatalogRecord,
  EsriReviewRecord,
  EsriSiteIdentity,
  EsriSiteTradeAreaLink,
  EsriTradeAreaRecord,
  PortfolioSiteReadiness,
} from "./types";

export * from "./readiness";
export * from "./trade-area-profile";
export * from "./candidate-evidence";
export * from "./candidate-evidence-fixtures";
export * from "./types";

export const esriDemoManifest = manifestJson as EsriDemoManifest;
export const esriFieldCatalog =
  fieldCatalogJson as EsriFieldCatalogRecord[];
export const esriSiteIdentities =
  siteIdentitiesJson as EsriSiteIdentity[];
export const esriTradeAreas = tradeAreasJson as EsriTradeAreaRecord[];
export const esriSiteTradeAreaCrosswalk =
  crosswalkJson as EsriSiteTradeAreaLink[];
export const esriPortfolioReadiness =
  readinessJson as PortfolioSiteReadiness[];
export const esriReviewRecords =
  reviewRecordsJson as EsriReviewRecord[];
export const esriTradeAreaProfiles = buildTradeAreaProfiles({
  sites: esriSiteIdentities,
  links: esriSiteTradeAreaCrosswalk,
  tradeAreas: esriTradeAreas,
  manifest: esriDemoManifest,
});
export const esriCandidateEvidenceBriefs = candidateEvidenceDemoSiteIds().map(
  (siteId) =>
    buildCandidateEvidenceBrief({
      siteId,
      manifest: esriDemoManifest,
      fieldCatalog: esriFieldCatalog,
      sites: esriSiteIdentities,
      readiness: esriPortfolioReadiness,
      links: esriSiteTradeAreaCrosswalk,
      profiles: esriTradeAreaProfiles,
    }),
);

export function getEsriSite(siteId: string) {
  return (
    esriSiteIdentities.find((site) => site.site_id === siteId) ?? null
  );
}

export function getEsriSiteTradeAreas(siteId: string) {
  const tradeAreaIds = new Set(
    esriSiteTradeAreaCrosswalk
      .filter((link) => link.site_id === siteId)
      .map((link) => link.trade_area_id),
  );
  return esriTradeAreas.filter((record) =>
    tradeAreaIds.has(record.trade_area_id),
  );
}
