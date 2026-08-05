import type { CensusGeography } from "./types.ts";

const FIPS_PATTERNS = {
  state: /^\d{2}$/,
  county: /^\d{3}$/,
  place: /^\d{5}$/,
  tract: /^\d{6}$/,
  blockGroup: /^\d$/,
  cbsa: /^\d{5}$/,
} as const;

const SUMMARY_LEVELS: Record<CensusGeography["type"], string> = {
  cbsa: "310",
  state: "040",
  county: "050",
  place: "160",
  tract: "140",
  block_group: "150",
};

function assertCode(label: keyof typeof FIPS_PATTERNS, value: string) {
  if (!FIPS_PATTERNS[label].test(value)) {
    throw new TypeError(
      `Invalid Census ${label} code "${value}". Expected ${FIPS_PATTERNS[label].source}.`,
    );
  }
}

export function validateGeography(geography: CensusGeography) {
  if (geography.type === "cbsa") {
    assertCode("cbsa", geography.cbsa);
    return;
  }
  assertCode("state", geography.state);

  if ("county" in geography) {
    assertCode("county", geography.county);
  }
  if ("place" in geography) {
    assertCode("place", geography.place);
  }
  if ("tract" in geography) {
    assertCode("tract", geography.tract);
  }
  if ("blockGroup" in geography) {
    assertCode("blockGroup", geography.blockGroup);
  }
}

export function geographyFips(geography: CensusGeography) {
  switch (geography.type) {
    case "cbsa":
      return geography.cbsa;
    case "state":
      return geography.state;
    case "county":
      return `${geography.state}${geography.county}`;
    case "place":
      return `${geography.state}${geography.place}`;
    case "tract":
      return `${geography.state}${geography.county}${geography.tract}`;
    case "block_group":
      return `${geography.state}${geography.county}${geography.tract}${geography.blockGroup}`;
  }
}

export function censusGeoId(geography: CensusGeography) {
  return `${SUMMARY_LEVELS[geography.type]}0000US${geographyFips(geography)}`;
}

export function geographyQuery(geography: CensusGeography) {
  switch (geography.type) {
    case "cbsa":
      return {
        forValue:
          `metropolitan statistical area/micropolitan statistical area:${geography.cbsa}`,
        inValue: null,
      };
    case "state":
      return { forValue: `state:${geography.state}`, inValue: null };
    case "county":
      return {
        forValue: `county:${geography.county}`,
        inValue: `state:${geography.state}`,
      };
    case "place":
      return {
        forValue: `place:${geography.place}`,
        inValue: `state:${geography.state}`,
      };
    case "tract":
      return {
        forValue: `tract:${geography.tract}`,
        inValue: `state:${geography.state} county:${geography.county}`,
      };
    case "block_group":
      return {
        forValue: `block group:${geography.blockGroup}`,
        inValue: `state:${geography.state} county:${geography.county} tract:${geography.tract}`,
      };
  }
}

export function responseFips(
  geography: CensusGeography,
  row: Readonly<Record<string, unknown>>,
) {
  const value = (key: string) =>
    typeof row[key] === "string" ? row[key] : "";

  switch (geography.type) {
    case "cbsa":
      return value(
        "metropolitan statistical area/micropolitan statistical area",
      );
    case "state":
      return value("state");
    case "county":
      return `${value("state")}${value("county")}`;
    case "place":
      return `${value("state")}${value("place")}`;
    case "tract":
      return `${value("state")}${value("county")}${value("tract")}`;
    case "block_group":
      return `${value("state")}${value("county")}${value("tract")}${value("block group")}`;
  }
}
