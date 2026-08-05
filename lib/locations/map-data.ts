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
];
