import type { OpportunitySector } from "./contracts.ts";

export type SectorSlug = "growth-marketing" | "pet-health" | "market-ecosystem";

export type SectorWorkspaceDefinition = {
  slug: SectorSlug;
  sector: OpportunitySector;
  code: string;
  name: string;
  eyebrow: string;
  mandate: string;
  description: string;
  playbookName: string;
  owner: string;
  outcome: string;
  opportunities: Array<{
    title: string;
    description: string;
    qualification: string;
  }>;
  currentData: Array<{
    name: string;
    use: string;
    status: "Synthetic" | "Public context";
    source: string;
  }>;
  plannedData: Array<{
    name: string;
    use: string;
    dependency: string;
    source: string;
  }>;
  guardrails: string[];
};

export const SECTOR_WORKSPACES: Record<SectorSlug, SectorWorkspaceDefinition> = {
  "growth-marketing": {
    slug: "growth-marketing",
    sector: "marketing",
    code: "GM",
    name: "Growth & marketing",
    eyebrow: "Regional demand and customer acquisition",
    mandate: "Find markets where customer interest is growing faster than Chewy's current reach.",
    description: "This workspace looks for evidence-backed gaps between regional category demand, existing customer penetration, addressable reach, and our ability to serve the market. It prepares bounded acquisition experiments for Marketing review.",
    playbookName: "Regional acquisition gap",
    owner: "Marketing",
    outcome: "Incremental customers or orders under an approved experiment design.",
    opportunities: [
      {
        title: "Acquisition gap",
        description: "Category interest is rising while customer penetration and eligible marketing reach remain comparatively low.",
        qualification: "Requires fresh demand, penetration, reach, and service-readiness evidence.",
      },
      {
        title: "Under-reached customer pocket",
        description: "A serviceable regional audience has relevant demand but limited recent campaign exposure.",
        qualification: "Future playbook. Audience, saturation, and exclusion rules require approval.",
      },
      {
        title: "Regional demand shift",
        description: "A sustained change in category engagement may justify focused market research or a controlled test.",
        qualification: "Future playbook. Trend windows and comparison baselines are unresolved.",
      },
    ],
    currentData: [
      { name: "Category-interest change", use: "Detects a synthetic regional demand increase.", status: "Synthetic", source: "SYN-OPP-MKT-001" },
      { name: "Penetration and reach indexes", use: "Represents the synthetic gap between interest and current reach.", status: "Synthetic", source: "SYN-OPP-MKT-002" },
      { name: "Delivery readiness", use: "Prevents a demand signal from advancing without synthetic service availability.", status: "Synthetic", source: "SYN-OPP-MKT-003" },
      { name: "CBSA market context", use: "Provides public market identity and aggregate context, never qualification.", status: "Public context", source: "SRC-014 · SRC-016" },
    ],
    plannedData: [
      { name: "Regional demand and engagement", use: "Measure category interest and qualified audience movement at an approved aggregate grain.", dependency: "Metric definition, privacy review, geography, and refresh owner", source: "Candidate internal aggregate" },
      { name: "Customer penetration", use: "Compare addressable demand with an approved aggregate customer baseline.", dependency: "Governance approval and minimum aggregation rules", source: "Candidate internal aggregate" },
      { name: "Campaign reach and saturation", use: "Identify under-reached markets without overexposing an audience.", dependency: "Channel definitions, attribution window, and campaign owner", source: "GTM context: SRC-004" },
      { name: "Delivery and inventory readiness", use: "Block experiments that cannot be served responsibly.", dependency: "Approved operational feeds and stop thresholds", source: "Production path unconfirmed" },
    ],
    guardrails: ["Acquisition cost", "Inventory availability", "Delivery coverage", "Campaign saturation"],
  },
  "pet-health": {
    slug: "pet-health",
    sector: "pet_health",
    code: "PH",
    name: "Pet health",
    eyebrow: "Clinic demand, capacity and awareness",
    mandate: "Find local demand that can be served without creating capacity or experience problems.",
    description: "This workspace brings demand, clinic awareness, staffed capacity, and service constraints together. It is designed to surface reviewable CVC opportunities without treating interest alone as proof that a clinic can absorb demand.",
    playbookName: "Clinic awareness and capacity",
    owner: "CVC",
    outcome: "Qualified bookings or completed visits under an approved test.",
    opportunities: [
      {
        title: "Awareness gap with capacity",
        description: "Appointment interest is increasing, staffed capacity is available, and local clinic awareness remains low.",
        qualification: "Requires fresh interest, capacity, awareness, and staffing readiness evidence.",
      },
      {
        title: "Service-access friction",
        description: "Demand exists but wait time, availability, cancellations, or service coverage may prevent conversion.",
        qualification: "Future playbook. Service thresholds and accountable owner are unresolved.",
      },
      {
        title: "Expansion research trigger",
        description: "Persistent unmet demand may justify a structured market or clinic-capacity investigation.",
        qualification: "Future playbook. This cannot recommend a site or expansion decision.",
      },
    ],
    currentData: [
      { name: "Appointment-interest change", use: "Detects a synthetic increase in local appointment interest.", status: "Synthetic", source: "SYN-OPP-CVC-001" },
      { name: "Available capacity", use: "Represents synthetic usable appointment capacity.", status: "Synthetic", source: "SYN-OPP-CVC-002" },
      { name: "Clinic awareness and staffing", use: "Tests synthetic awareness and staffed-capacity readiness.", status: "Synthetic", source: "SYN-OPP-CVC-003" },
      { name: "CBSA and clinic context", use: "Provides public market context and a minimized internal-demo reference only.", status: "Public context", source: "SRC-014 · SRC-016 · SRC-017" },
    ],
    plannedData: [
      { name: "Appointments and qualified demand", use: "Measure bookings, completed visits, cancellations, and demand movement.", dependency: "Outcome definition, maturity window, access, and aggregation approval", source: "Candidate dashboards: SRC-002" },
      { name: "Staffed clinic capacity", use: "Distinguish theoretical availability from capacity that can safely serve demand.", dependency: "Formula, threshold, and operational owner", source: "Reported concept: SRC-008" },
      { name: "Awareness and referral engagement", use: "Identify local awareness or trust gaps without converting qualitative research into a score.", dependency: "Approved measure and research interpretation", source: "Research context: SRC-007" },
      { name: "Clinic geography and service mix", use: "Confirm that demand and available services share an approved geographic relationship.", dependency: "Approved geography, clinic identity, and refresh path", source: "Prototype snapshot: SRC-017" },
    ],
    guardrails: ["Staffed capacity", "Wait time", "Cancellations", "Service availability"],
  },
  "market-ecosystem": {
    slug: "market-ecosystem",
    sector: "ecosystem",
    code: "ME",
    name: "Market ecosystem",
    eyebrow: "Competitive and local market change",
    mandate: "Detect verified local changes early enough to prepare a coordinated, bounded response.",
    description: "This workspace watches for external events that change a local market, then combines verification, demand, competition, service coverage, and operating guardrails into a prepared ActionPacket. It does not act on the packet or treat an event as an opportunity by itself.",
    playbookName: "Local competitor closure",
    owner: "Market Expansion",
    outcome: "Time from event detection to verified disposition, followed by an approved receiving-team measure.",
    opportunities: [
      {
        title: "Verified competitor closure",
        description: "A permanent local closure occurs while relevant demand remains stable and no replacement competitor is confirmed.",
        qualification: "Requires verified identity, location, permanence, date, demand, geography, and operating guardrails.",
      },
      {
        title: "Competitive entry or expansion",
        description: "A new or expanded competitor may change local customer choice, capacity, or acquisition dynamics.",
        qualification: "Future playbook. Event taxonomy and response ownership require approval.",
      },
      {
        title: "Local disruption or partnership signal",
        description: "A business, regulatory, service, or community change may warrant cross-functional investigation.",
        qualification: "Future playbook. Trusted sources and materiality thresholds are unresolved.",
      },
    ],
    currentData: [
      { name: "Closure event and verification", use: "Provides a fictional retailer identity, location, permanence, and source record.", status: "Synthetic", source: "SYN-OPP-ECO-001" },
      { name: "Demand and replacement context", use: "Tests synthetic local demand stability and replacement-competitor presence.", status: "Synthetic", source: "SYN-OPP-ECO-002" },
      { name: "Operating guardrails", use: "Checks synthetic delivery, inventory, CVC presence, and campaign saturation.", status: "Synthetic", source: "SYN-OPP-ECO-003" },
      { name: "CBSA market identity", use: "Locates the workflow in the public market universe without scoring it.", status: "Public context", source: "SRC-014 · SRC-015" },
    ],
    plannedData: [
      { name: "Verified business events", use: "Detect closures, openings, relocations, and other material local changes.", dependency: "Licensed or approved sources, verification policy, event taxonomy, and retention", source: "No approved source yet" },
      { name: "Competitive landscape", use: "Determine whether a change creates a durable gap or is already being replaced.", dependency: "Access, identity rules, refresh cadence, and production use approval", source: "Candidate dashboard: SRC-011" },
      { name: "Local demand context", use: "Test whether relevant demand is stable enough to justify investigation.", dependency: "Approved aggregate measure, geography, baseline, and freshness rule", source: "Production path unconfirmed" },
      { name: "Cross-functional readiness", use: "Prevent a response when delivery, inventory, campaigns, or clinic capacity are constrained.", dependency: "Approved owners, thresholds, and stop conditions", source: "Production path unconfirmed" },
    ],
    guardrails: ["Source verification", "Event freshness", "Demand floor", "Delivery", "Inventory", "Clinic capacity"],
  },
};

export const SECTOR_SLUGS = Object.keys(SECTOR_WORKSPACES) as SectorSlug[];
