export const CENSUS_GEOCODER_SOURCE_ID = "SRC-013";
export const CENSUS_GEOCODER_BENCHMARK = "Public_AR_Current";

export type ResolvedAddress = {
  inputAddress: string;
  matchedAddress: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  provider: "U.S. Census Geocoder";
  providerVersion: string;
  sourceId: typeof CENSUS_GEOCODER_SOURCE_ID;
  evidenceStatus: "Derived";
  resolvedAt: string;
};

export type AddressResolutionResult =
  | {
      status: "matched";
      match: ResolvedAddress;
    }
  | {
      status: "no_match";
      message: string;
    };

type CensusAddressMatch = {
  matchedAddress?: unknown;
  coordinates?: {
    x?: unknown;
    y?: unknown;
  };
  addressComponents?: {
    city?: unknown;
    state?: unknown;
    zip?: unknown;
  };
};

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Converts the public Census response into the provider-neutral address shape.
 * A match is geocoded evidence, not proof of deliverability or site existence.
 */
export function parseCensusAddressResponse(
  payload: unknown,
  inputAddress: string,
  resolvedAt: string,
): AddressResolutionResult {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("result" in payload) ||
    typeof payload.result !== "object" ||
    payload.result === null
  ) {
    return {
      status: "no_match",
      message: "The address provider returned an unreadable response.",
    };
  }

  const result = payload.result as {
    addressMatches?: unknown;
    input?: {
      benchmark?: {
        benchmarkName?: unknown;
      };
    };
  };
  const matches = Array.isArray(result.addressMatches)
    ? (result.addressMatches as CensusAddressMatch[])
    : [];
  const match = matches[0];
  const longitude = match?.coordinates?.x;
  const latitude = match?.coordinates?.y;
  const matchedAddress = match?.matchedAddress;
  const city = match?.addressComponents?.city;
  const state = match?.addressComponents?.state;
  const zip = match?.addressComponents?.zip;

  if (
    typeof matchedAddress !== "string" ||
    typeof city !== "string" ||
    typeof state !== "string" ||
    typeof zip !== "string" ||
    !isFiniteCoordinate(latitude) ||
    !isFiniteCoordinate(longitude)
  ) {
    return {
      status: "no_match",
      message:
        "No complete Census address match was found. Check the street, city, state, and ZIP code.",
    };
  }

  const benchmarkName = result.input?.benchmark?.benchmarkName;

  return {
    status: "matched",
    match: {
      inputAddress,
      matchedAddress,
      city,
      state,
      zip,
      latitude,
      longitude,
      provider: "U.S. Census Geocoder",
      providerVersion:
        typeof benchmarkName === "string"
          ? benchmarkName
          : CENSUS_GEOCODER_BENCHMARK,
      sourceId: CENSUS_GEOCODER_SOURCE_ID,
      evidenceStatus: "Derived",
      resolvedAt,
    },
  };
}
