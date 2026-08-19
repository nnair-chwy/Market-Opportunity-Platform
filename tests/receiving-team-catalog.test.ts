import assert from "node:assert/strict";
import test from "node:test";
import {
  getReceivingTeam,
  receivingTeamCatalog,
  receivingTeamCatalogSchema,
  routeAutonomousGeoFinding,
} from "../lib/planning/receiving-team-catalog.ts";

test("catalog contains every confirmed receiving team with evidence and approval boundaries", () => {
  const parsed = receivingTeamCatalogSchema.parse(receivingTeamCatalog);
  assert.equal(parsed.teams.length, 9);
  assert.equal(new Set(parsed.teams.map((team) => team.id)).size, 9);
  assert.ok(parsed.teams.every((team) => team.caresAbout.length && team.applicableActions.length && team.requiredEvidence.length && team.approvalBoundary.length));
  assert.equal(getReceivingTeam("measurement_analytics").label, "Measurement / Analytics");
  assert.match(getReceivingTeam("measurement_analytics").approvalBoundary, /does not own/i);
  assert.doesNotMatch(JSON.stringify(parsed), /@[a-z]|named person|individual approver/i);
});

test("paid media routes to Growth Marketing with validation and outcome partners", () => {
  const route = routeAutonomousGeoFinding({ perspectiveId: "marketing", viewId: "paid_search_cpc", topic: "local_growth" });
  assert.equal(route.primaryTeam.teamId, "growth_marketing");
  assert.deepEqual(route.partnerTeams.map((team) => team.teamId), ["measurement_analytics", "delivery_experience", "merchandising_category"]);
  assert.match(route.approvalBoundary, /spend.*require/i);
});

test("SEO and Brand findings route to their distinct primary teams", () => {
  const seo = routeAutonomousGeoFinding({ perspectiveId: "marketing", viewId: "local_engagement", topic: "market_context" });
  assert.equal(seo.primaryTeam.teamId, "seo_content");
  assert.ok(seo.partnerTeams.some((team) => team.teamId === "growth_marketing"));
  assert.ok(seo.partnerTeams.some((team) => team.teamId === "brand_consumer_insights"));

  const brand = routeAutonomousGeoFinding({ perspectiveId: "marketing", viewId: "customer_demand", topic: "consumer_insights" });
  assert.equal(brand.primaryTeam.teamId, "brand_consumer_insights");
  assert.ok(brand.partnerTeams.some((team) => team.teamId === "seo_content"));
});

test("Pricing routes competitor evidence to Pricing with category and delivery partners", () => {
  const route = routeAutonomousGeoFinding({ perspectiveId: "pricing", viewId: "competitor_availability", topic: "regional_context" });
  assert.equal(route.primaryTeam.teamId, "pricing");
  assert.deepEqual(route.partnerTeams.map((team) => team.teamId), ["measurement_analytics", "merchandising_category", "delivery_experience"]);
  assert.match(route.approvalBoundary, /no price, match, or override/i);
});

test("clinic performance and site diligence route to different CVC primary teams", () => {
  const operations = routeAutonomousGeoFinding({ perspectiveId: "cvc", viewId: "clinic_performance_context", topic: "clinic_performance" });
  assert.equal(operations.primaryTeam.teamId, "clinic_operations");
  assert.ok(operations.partnerTeams.some((team) => team.teamId === "clinic_real_estate"));

  const realEstate = routeAutonomousGeoFinding({ perspectiveId: "cvc", viewId: "market_expansion_context", topic: "clinic_location" });
  assert.equal(realEstate.primaryTeam.teamId, "clinic_real_estate");
  assert.ok(realEstate.partnerTeams.some((team) => team.teamId === "clinic_operations"));
  assert.match(realEstate.approvalBoundary, /cannot select a site/i);
});

test("routing is deterministic and rejects a view from the wrong perspective", () => {
  const input = { perspectiveId: "marketing" as const, viewId: "paid_search_response" as const, topic: "google_ads_context" as const };
  assert.deepEqual(routeAutonomousGeoFinding(input), routeAutonomousGeoFinding(input));
  assert.throws(() => routeAutonomousGeoFinding({ perspectiveId: "pricing", viewId: "clinic_footprint", topic: "clinic_context" }), /does not belong/i);
});
