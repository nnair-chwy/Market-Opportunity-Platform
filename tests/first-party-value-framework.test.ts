import assert from "node:assert/strict";
import test from "node:test";
import {
  CHEWY_VALUE_DEFINITIONS,
  TABLEAU_FIRST_PARTY_EXPORTS,
  assessBusinessValue,
} from "../lib/business-value/first-party-value-framework.ts";

test("value definitions preserve the governed distinction between CCP, CCV, and attributed proxies", () => {
  assert.match(CHEWY_VALUE_DEFINITIONS.ccp.definition, /order contribution.*downstream customer value/i);
  assert.match(CHEWY_VALUE_DEFINITIONS.ccv.definition, /retail CCP.*Ads contribution profit/i);
  assert.match(CHEWY_VALUE_DEFINITIONS.marketingEfficiency.definition, /counterfactual.*not the same as platform-attributed/i);
});

test("reviewed Tableau workbooks declare target grain, metrics, and honest connection limits", () => {
  const dma = TABLEAU_FIRST_PARTY_EXPORTS.find((source) => source.id === "dma-marketing-outcomes");
  const cvc = TABLEAU_FIRST_PARTY_EXPORTS.find((source) => source.id === "cvc-site-outcomes");
  const ccp = TABLEAU_FIRST_PARTY_EXPORTS.find((source) => source.id === "ccp-channel-value");
  const newCustomers = TABLEAU_FIRST_PARTY_EXPORTS.find((source) => source.id === "new-customer-acquisition");
  assert.equal(dma?.status, "available_partial");
  assert.match(dma?.targetGrain ?? "", /DMA/i);
  assert.match(dma?.limitation ?? "", /not incremental or CCP-valued/i);
  assert.equal(cvc?.status, "available_now");
  assert.ok(cvc?.metrics.includes("completed appointments"));
  assert.match(cvc?.limitation ?? "", /connected.*historical.*crosswalk/i);
  assert.equal(ccp?.status, "needs_geo_join");
  assert.equal(newCustomers?.status, "needs_geo_join");
  assert.match(newCustomers?.limitation ?? "", /no approved DMA field/i);
});

test("departments receive explicit opportunity formulas without inventing outcomes", () => {
  assert.equal(assessBusinessValue("marketing").status, "proxy_only");
  assert.match(assessBusinessValue("marketing").formula, /counterfactual CCP/i);
  assert.equal(assessBusinessValue("cvc").status, "export_available");
  assert.match(assessBusinessValue("cvc").formula, /completed appointments/i);
  assert.equal(assessBusinessValue("pricing").status, "outcome_missing");
  assert.match(assessBusinessValue("pricing").formula, /contribution opportunity/i);
});
