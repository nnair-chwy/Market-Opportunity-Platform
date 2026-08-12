import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("renders a sector-led opportunity platform starting state", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const { OpportunityInbox } = await vite.ssrLoadModule(
    "/components/opportunity-inbox/OpportunityInbox.tsx",
  );
  const html = renderToStaticMarkup(createElement(OpportunityInbox));

  assert.match(html, /Market Opportunity/);
  assert.match(html, /Opportunity portfolio/);
  assert.match(html, /Growth &amp; marketing/);
  assert.match(html, /Pet health/);
  assert.match(html, /Market ecosystem/);
  assert.match(html, /Opportunity register/);
  assert.match(html, /National opportunity radar/);
  assert.match(html, /Every registered market, one visible process/);
  assert.match(html, /Markets monitored/);
  assert.match(html, /From signal intake to human review/);
  assert.match(html, /Operational scan status across the public CBSA universe/);
  assert.match(html, /Validated market changes are separated by business sector/);
  assert.match(html, /Select an opportunity/);
  assert.doesNotMatch(html, /Ask AI|AI-generated|autonomous recommendation/i);
});

test("renders three distinct sector workspaces with explicit data maturity", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const { SectorWorkspace } = await vite.ssrLoadModule(
    "/components/opportunity-inbox/SectorWorkspace.tsx",
  );
  const { SECTOR_WORKSPACES } = await vite.ssrLoadModule(
    "/lib/opportunity-inbox/sector-catalog.ts",
  );

  for (const definition of Object.values(SECTOR_WORKSPACES)) {
    const html = renderToStaticMarkup(createElement(SectorWorkspace, { definition }));
    assert.match(html, new RegExp(definition.name.replace("&", "&amp;")));
    assert.match(html, /Sector profile/);
    assert.match(html, /Opportunities &amp; blockers/);
    assert.match(html, /What this sector is looking for/);
    assert.match(html, /Prototype inputs/);
    assert.match(html, /Planned, not connected/);
    assert.match(html, /Approval required/);
    assert.match(html, /Evidence becomes a reviewable opportunity/);
  }
});

test("renders the ecosystem ActionPacket without human approval controls", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const { ActionPacketDetail } = await vite.ssrLoadModule(
    "/components/opportunity-inbox/OpportunityInbox.tsx",
  );
  const domain = await vite.ssrLoadModule("/lib/opportunity-inbox/index.ts");
  const opportunity = domain.runPlaybooks(
    domain.validateSignalBatch(domain.getFixtureBatch()),
    "2026-08-05T16:00:00.000Z",
  ).find((item) => item.sector === "ecosystem");
  assert.ok(opportunity?.actionPacket);

  const html = renderToStaticMarkup(createElement(ActionPacketDetail, { opportunity }));
  assert.match(html, /System disposition/);
  assert.match(html, /Prepared course of action/);
  assert.match(html, /NorthSound Pet Market|What the platform already checked/);
  assert.match(html, /Remaining blockers/);
  assert.match(html, /None/);
  assert.match(html, /Ordered synthetic actions/);
  assert.match(html, /Advance conditions/);
  assert.match(html, /Stop conditions/);
  assert.match(html, /Packet provenance/);
  assert.doesNotMatch(html, /Approve for routing|Request more evidence|Record a disposition/);
});

test("renders the reusable opportunity workflow for sector workspaces", async (t) => {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());

  const { OpportunityDetail } = await vite.ssrLoadModule(
    "/components/opportunity-inbox/OpportunityInbox.tsx",
  );
  const domain = await vite.ssrLoadModule("/lib/opportunity-inbox/index.ts");
  const opportunity = domain.runPlaybooks(
    domain.validateSignalBatch(domain.getFixtureBatch()),
    "2026-08-05T16:00:00.000Z",
  ).find((item) => item.sector === "marketing");
  assert.ok(opportunity);

  const html = renderToStaticMarkup(createElement(OpportunityDetail, {
    opportunity,
    reviewReason: "Synthetic review rationale.",
    setReviewReason: () => {},
    review: async () => {},
    prepareDelivery: async () => {},
    delivery: null,
    busy: false,
  }));
  assert.match(html, /Evidence ledger/);
  assert.match(html, /Record a disposition/);
  assert.match(html, /Approve for routing/);
  assert.match(html, /Prepare communication/);
  assert.match(html, /Audit history/);
});
