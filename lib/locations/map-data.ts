export type CurrentClinic = {
  id: string;
  name: string;
  market: string;
  city: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
};

export type FulfillmentCenter = {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  /** Derived map pin; the street address remains the authoritative location input. */
  latitude: number;
  longitude: number;
  sourceUrls: readonly string[];
  evidenceStatus: "Confirmed" | "Reported";
  coordinateStatus: "Derived address geocode";
};

export const currentClinics: readonly CurrentClinic[] = [
  { id: "fountain-oaks", name: "Fountain Oaks", market: "Atlanta", city: "Atlanta", state: "GA", address: "4920 Roswell Rd NE Ste 48-49, Atlanta, GA 30342", latitude: 33.8895503, longitude: -84.3814993, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/ga/atlanta/4920-roswell-rd-ne-suites-48-49" },
  { id: "perimeter", name: "Perimeter", market: "Atlanta", city: "Atlanta", state: "GA", address: "4531 Olde Perimeter Way Ste 150, Atlanta, GA 30346", latitude: 33.9295912, longitude: -84.3432497, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/ga/atlanta/4531-olde-perimeter-way-suite-150" },
  { id: "halcyon", name: "Halcyon", market: "Atlanta", city: "Alpharetta", state: "GA", address: "6135 Ollie Walk Ste 300, Alpharetta, GA 30005", latitude: 34.1097682, longitude: -84.2204057, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/ga/alpharetta/6135-ollie-walk-suite-300" },
  { id: "midtown", name: "Midtown", market: "Atlanta", city: "Atlanta", state: "GA", address: "811 Peachtree St NE Ste 1A, Atlanta, GA 30308", latitude: 33.7770015, longitude: -84.384381, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/ga/atlanta/811-peachtree-st-ne-suite-1a" },
  { id: "the-triangle", name: "The Triangle", market: "Austin", city: "Austin", state: "TX", address: "4700 W Guadalupe St Bldg A Ste A-1, Austin, TX 78751", latitude: 30.3150797, longitude: -97.7324132, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/tx/austin/4700-w-guadalupe-street-bldg-a-suite-a-1" },
  { id: "creekwalk", name: "Creekwalk", market: "Colorado Springs", city: "Colorado Springs", state: "CO", address: "100 E Cheyenne Rd Ste 100, Colorado Springs, CO 80906", latitude: 38.8066947, longitude: -104.8254357, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/co/colorado-springs/100-e-cheyenne-rd-suite-100" },
  { id: "north-academy", name: "North Academy", market: "Colorado Springs", city: "Colorado Springs", state: "CO", address: "7395 N Academy Blvd, Colorado Springs, CO 80920", latitude: 38.9380602, longitude: -104.7981281, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/co/colorado-springs/7395-n-academy-blvd" },
  { id: "mckinney", name: "McKinney", market: "Dallas", city: "McKinney", state: "TX", address: "8701 W University Dr Ste 430, McKinney, TX 75071", latitude: 33.218535, longitude: -96.729492, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/tx/mckinney/8701-west-university-drive-suite-430" },
  { id: "alliance", name: "Alliance", market: "Dallas", city: "Fort Worth", state: "TX", address: "3251 Tracewood Way Ste 131, Fort Worth, TX 76177", latitude: 32.9162, longitude: -97.3167, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/tx/fort-worth/3251-tracewood-way-suite-131" },
  { id: "highlands-ranch", name: "Highlands Ranch", market: "Denver", city: "Highlands Ranch", state: "CO", address: "9325 Dorchester St Ste 128, Highlands Ranch, CO 80129", latitude: 39.5465195, longitude: -104.9988623, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/co/highlands-ranch/9325-dorchester-st-suite-128" },
  { id: "9-co", name: "9+CO", market: "Denver", city: "Denver", state: "CO", address: "4193 E 8th Ave, Denver, CO 80220", latitude: 39.7292819, longitude: -104.9384428, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/co/denver/4193-e-8th-ave" },
  { id: "littleton", name: "Littleton", market: "Denver", city: "Littleton", state: "CO", address: "8555 W Belleview Ave Ste D26, Littleton, CO 80123", latitude: 39.6242519, longitude: -105.0921945, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/co/littleton/8555-w-belleview-avenue-suite-D26" },
  { id: "louisville", name: "Louisville", market: "Denver", city: "Louisville", state: "CO", address: "459 McCaslin Blvd Ste 6, Louisville, CO 80027", latitude: 39.9648577, longitude: -105.1641366, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/co/louisville/459-mccaslin-blvd-suite-6-8" },
  { id: "fort-collins", name: "Fort Collins", market: "Fort Collins", city: "Fort Collins", state: "CO", address: "2860 E Harmony Rd Ste 110, Fort Collins, CO 80528", latitude: 40.5235318, longitude: -105.0203897, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/co/fort-collins/2860-e-harmony-road-suite-110" },
  { id: "meyerland", name: "Meyerland", market: "Houston", city: "Houston", state: "TX", address: "8845 W Loop South Ste A, Houston, TX 77096", latitude: 29.6855552, longitude: -95.4584242, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/tx/houston/8845-w-loop-south-suite-a" },
  { id: "cinco-ranch", name: "Cinco Ranch", market: "Houston", city: "Katy", state: "TX", address: "2717 Commercial Center Blvd Ste D110, Katy, TX 77494", latitude: 29.7417749, longitude: -95.7767843, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/tx/katy/2717-commercial-center-blvd-suite-d110" },
  { id: "beach-boulevard", name: "Beach Boulevard", market: "Jacksonville", city: "Jacksonville", state: "FL", address: "12675 Beach Blvd Ste 102, Jacksonville, FL 32246", latitude: 30.2873849, longitude: -81.4884959, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/fl/jacksonville/12675-beach-boulevard-suite-102" },
  { id: "chandler", name: "Chandler", market: "Phoenix", city: "Chandler", state: "AZ", address: "3355 W Chandler Blvd Ste 2, Chandler, AZ 85226", latitude: 33.3056565, longitude: -111.8988876, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/az/chandler/3355-west-chandler-blvd-suite-2" },
  { id: "plantation", name: "Plantation", market: "South Florida", city: "Plantation", state: "FL", address: "301 N University Dr Ste S2-400, Plantation, FL 33324", latitude: 26.1252916, longitude: -80.2559302, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/fl/plantation/301-n-university-dr-suite-s2-400" },
  { id: "coral-springs", name: "Coral Springs", market: "South Florida", city: "Coral Springs", state: "FL", address: "2920 N University Dr, Coral Springs, FL 33065", latitude: 26.2654278, longitude: -80.2501944, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/fl/coral-springs/2920-n-university-dr" },
  { id: "delray-beach", name: "Delray Beach", market: "South Florida", city: "Delray Beach", state: "FL", address: "1911 S Federal Hwy Ste 200, Delray Beach, FL 33483", latitude: 26.437691, longitude: -80.0717727, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/fl/delray-beach/1911-south-federal-highway-suite-200" },
  { id: "aventura", name: "Aventura", market: "South Florida", city: "Aventura", state: "FL", address: "2747 NE 193rd St Ste 14, Aventura, FL 33180", latitude: 25.9540636, longitude: -80.1454178, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/fl/aventura/2747-ne-193rd-st-suite-14" },
  { id: "boynton-beach", name: "Boynton Beach", market: "South Florida", city: "Boynton Beach", state: "FL", address: "1500 Gateway Blvd Ste 150B, Boynton Beach, FL 33426", latitude: 26.5461588, longitude: -80.0874485, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/fl/boynton-beach/1500-gateway-blvd-suite-150B" },
  { id: "lutz", name: "Lutz", market: "Tampa", city: "Lutz", state: "FL", address: "17637 Harpers Run, Lutz, FL 33558", latitude: 28.1819, longitude: -82.4615, sourceUrl: "https://www.chewy.com/vet-care/vet-near-me/fl/lutz/17637-harpers-run" },
];

/**
 * Public Chewy network context for the map. These are context points only and
 * must not be treated as clinic candidates, scoring inputs, or fulfillment
 * optimization targets.
 */
export const fulfillmentCenters: readonly FulfillmentCenter[] = [
  { id: "wilkes-barre", name: "Wilkes-Barre Fulfillment Center", city: "Wilkes-Barre", state: "PA", address: "600 New Commerce Boulevard, Wilkes-Barre, PA 18706", latitude: 41.2237, longitude: -75.9062, sourceUrls: ["https://careers.chewy.com/us/en/c/fulfillment-center-operations-jobs", "https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "goodyear", name: "Goodyear Fulfillment Center", city: "Goodyear", state: "AZ", address: "255 S 143rd Avenue, Goodyear, AZ 85338", latitude: 33.4427, longitude: -112.3667, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "clayton", name: "Clayton Fulfillment Center", city: "Clayton", state: "IN", address: "1974 Innovation Boulevard, Clayton, IN 46118", latitude: 39.6724, longitude: -86.5142, sourceUrls: ["https://careers.chewy.com/us/en/c/fulfillment-center-operations-jobs", "https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "dallas", name: "Dallas Fulfillment Center", city: "Dallas", state: "TX", address: "7243 Grady Niblo Road, Dallas, TX 75236", latitude: 32.6847, longitude: -96.9769, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "ocala", name: "Ocala Fulfillment Center", city: "Ocala", state: "FL", address: "3380 NW 35th Avenue Road, Ocala, FL 34475", latitude: 29.2128, longitude: -82.1817, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "dayton", name: "Dayton Fulfillment Center", city: "Dayton", state: "OH", address: "3280 Lightner Road, Dayton, OH 45377", latitude: 39.8752, longitude: -84.2874, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "salisbury", name: "Salisbury Fulfillment Center", city: "Salisbury", state: "NC", address: "255 Front Creek Road, Salisbury, NC 28146", latitude: 35.6962, longitude: -80.5795, sourceUrls: ["https://careers.chewy.com/us/en/c/fulfillment-center-operations-jobs", "https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "mount-juliet", name: "Mount Juliet Fulfillment Center", city: "Mount Juliet", state: "TN", address: "1281 Couchville Pike, Mount Juliet, TN 37122", latitude: 36.2001, longitude: -86.5186, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650224000014/chwy-20240128.htm", "https://chewybenefits.com/wp-content/uploads/2026/03/Chewy-2025-Benefits-Guide_English_25-1204B.pdf"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "jessup", name: "Jessup Fulfillment Center", city: "Jessup", state: "PA", address: "37 Archbald Heights Road, Jessup, PA 18434", latitude: 41.4767, longitude: -75.5688, sourceUrls: ["https://careers.chewy.com/us/en/c/fulfillment-center-operations-jobs", "https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "belton", name: "Belton Fulfillment Center", city: "Belton", state: "MO", address: "15999 S Outer Road, Belton, MO 64012", latitude: 38.7981, longitude: -94.5268, sourceUrls: ["https://careers.chewy.com/us/en/c/fulfillment-center-operations-jobs", "https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "lewisberry", name: "Lewisberry Fulfillment Center", city: "Lewisberry", state: "PA", address: "100 Goodman Drive, Lewisberry, PA 17339", latitude: 40.1718, longitude: -76.8636, sourceUrls: ["https://careers.chewy.com/us/en/c/fulfillment-center-operations-jobs", "https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "reno", name: "Reno Fulfillment Center", city: "Reno", state: "NV", address: "8001 N Virginia Street, Reno, NV 89506", latitude: 39.5736, longitude: -119.8244, sourceUrls: ["https://careers.chewy.com/us/en/c/fulfillment-center-operations-jobs", "https://www.sec.gov/Archives/edgar/data/1766502/000176650224000014/chwy-20240128.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "pittston", name: "Pittston Fulfillment Center", city: "Pittston", state: "PA", address: "360 Research Drive, Pittston, PA 18640", latitude: 41.3169, longitude: -75.7894, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "louisville", name: "Louisville Fulfillment Center", city: "Louisville", state: "KY", address: "11403 Bluegrass Parkway, Suite 650, Louisville, KY 40299", latitude: 38.1964, longitude: -85.5069, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650226000034/chwy-20260201.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
  { id: "houston", name: "Houston Fulfillment Center", city: "Houston", state: "TX", address: "13250 Crosby Road, Houston, TX 77049", latitude: 29.9162, longitude: -95.0565, sourceUrls: ["https://www.houstonchronicle.com/news/real-estate/article/chewy-houston-fulfillment-center-20329296.php"], evidenceStatus: "Reported", coordinateStatus: "Derived address geocode" },
  { id: "kleinburg", name: "Kleinburg Fulfillment Center", city: "Kleinburg", state: "ON", address: "12333 Airport Road, Kleinburg, Ontario, Canada L7C 2X3", latitude: 43.8556, longitude: -79.6427, sourceUrls: ["https://www.sec.gov/Archives/edgar/data/1766502/000176650224000014/chwy-20240128.htm"], evidenceStatus: "Confirmed", coordinateStatus: "Derived address geocode" },
];
