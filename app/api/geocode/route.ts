import {
  CENSUS_GEOCODER_BENCHMARK,
  parseCensusAddressResponse,
} from "@/lib/address-resolution";

const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json(
      { status: "error", message: "Enter a valid address." },
      { status: 400 },
    );
  }

  const address =
    typeof input === "object" &&
    input !== null &&
    "address" in input &&
    typeof input.address === "string"
      ? input.address.trim()
      : "";

  if (address.length < 8 || address.length > 240) {
    return Response.json(
      {
        status: "error",
        message:
          "Enter a complete U.S. street address between 8 and 240 characters.",
      },
      { status: 400 },
    );
  }

  const url = new URL(CENSUS_GEOCODER_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", CENSUS_GEOCODER_BENCHMARK);
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        {
          status: "error",
          message:
            "The Census address service is temporarily unavailable. Try again later.",
        },
        { status: 502 },
      );
    }

    const result = parseCensusAddressResponse(
      await response.json(),
      address,
      new Date().toISOString(),
    );

    return Response.json(result, {
      status: result.status === "matched" ? 200 : 422,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        status: "error",
        message:
          "The Census address service could not be reached. Try again later.",
      },
      { status: 502 },
    );
  }
}
