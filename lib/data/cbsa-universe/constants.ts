import type { CbsaType } from "./types.ts";

export const MAINLAND_STATE_BY_FIPS = {
  "01": { code: "AL", name: "Alabama" },
  "04": { code: "AZ", name: "Arizona" },
  "05": { code: "AR", name: "Arkansas" },
  "06": { code: "CA", name: "California" },
  "08": { code: "CO", name: "Colorado" },
  "09": { code: "CT", name: "Connecticut" },
  "10": { code: "DE", name: "Delaware" },
  "11": { code: "DC", name: "District of Columbia" },
  "12": { code: "FL", name: "Florida" },
  "13": { code: "GA", name: "Georgia" },
  "16": { code: "ID", name: "Idaho" },
  "17": { code: "IL", name: "Illinois" },
  "18": { code: "IN", name: "Indiana" },
  "19": { code: "IA", name: "Iowa" },
  "20": { code: "KS", name: "Kansas" },
  "21": { code: "KY", name: "Kentucky" },
  "22": { code: "LA", name: "Louisiana" },
  "23": { code: "ME", name: "Maine" },
  "24": { code: "MD", name: "Maryland" },
  "25": { code: "MA", name: "Massachusetts" },
  "26": { code: "MI", name: "Michigan" },
  "27": { code: "MN", name: "Minnesota" },
  "28": { code: "MS", name: "Mississippi" },
  "29": { code: "MO", name: "Missouri" },
  "30": { code: "MT", name: "Montana" },
  "31": { code: "NE", name: "Nebraska" },
  "32": { code: "NV", name: "Nevada" },
  "33": { code: "NH", name: "New Hampshire" },
  "34": { code: "NJ", name: "New Jersey" },
  "35": { code: "NM", name: "New Mexico" },
  "36": { code: "NY", name: "New York" },
  "37": { code: "NC", name: "North Carolina" },
  "38": { code: "ND", name: "North Dakota" },
  "39": { code: "OH", name: "Ohio" },
  "40": { code: "OK", name: "Oklahoma" },
  "41": { code: "OR", name: "Oregon" },
  "42": { code: "PA", name: "Pennsylvania" },
  "44": { code: "RI", name: "Rhode Island" },
  "45": { code: "SC", name: "South Carolina" },
  "46": { code: "SD", name: "South Dakota" },
  "47": { code: "TN", name: "Tennessee" },
  "48": { code: "TX", name: "Texas" },
  "49": { code: "UT", name: "Utah" },
  "50": { code: "VT", name: "Vermont" },
  "51": { code: "VA", name: "Virginia" },
  "53": { code: "WA", name: "Washington" },
  "54": { code: "WV", name: "West Virginia" },
  "55": { code: "WI", name: "Wisconsin" },
  "56": { code: "WY", name: "Wyoming" },
} as const;

export const NON_MAINLAND_STATE_OR_TERRITORY_BY_FIPS = {
  "02": { code: "AK", name: "Alaska" },
  "15": { code: "HI", name: "Hawaii" },
  "60": { code: "AS", name: "American Samoa" },
  "66": { code: "GU", name: "Guam" },
  "69": { code: "MP", name: "Northern Mariana Islands" },
  "72": { code: "PR", name: "Puerto Rico" },
  "78": { code: "VI", name: "U.S. Virgin Islands" },
} as const;

export const STATE_OR_TERRITORY_BY_FIPS = {
  ...MAINLAND_STATE_BY_FIPS,
  ...NON_MAINLAND_STATE_OR_TERRITORY_BY_FIPS,
} as const;

export const MAINLAND_STATE_FIPS = new Set(
  Object.keys(MAINLAND_STATE_BY_FIPS),
);

export const CBSA_TYPE_LABELS: Readonly<Record<string, CbsaType>> = {
  "Metropolitan Statistical Area": "metropolitan",
  "Micropolitan Statistical Area": "micropolitan",
};

export const DELINEATION_COLUMNS = [
  "CBSA Code",
  "Metropolitan Division Code",
  "CSA Code",
  "CBSA Title",
  "Metropolitan/Micropolitan Statistical Area",
  "Metropolitan Division Title",
  "CSA Title",
  "County/County Equivalent",
  "State Name",
  "FIPS State Code",
  "FIPS County Code",
  "Central/Outlying County",
] as const;

export const PRINCIPAL_CITY_COLUMNS = [
  "CBSA Code",
  "CBSA Title",
  "Metropolitan/Micropolitan Statistical Area",
  "Principal City Name",
  "FIPS State Code",
  "FIPS Place Code",
] as const;
