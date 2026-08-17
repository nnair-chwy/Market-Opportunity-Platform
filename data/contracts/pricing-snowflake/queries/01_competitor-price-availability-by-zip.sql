-- Intended output: competitor-price-geo_latest-by-zip-competitor-sku-30d.csv
-- Grain: latest observed competitor x ZIP x SKU offer in the last 30 days.
-- Keep ZIP_CODE as text when exporting.
select
  competitor_name,
  zip_code,
  product_part_number,
  competitor_offer_date,
  competitor_item_availability,
  competitor_price,
  competitor_in_cart_price,
  coupon,
  equalized_price,
  total_size,
  total_uom,
  package_quantity,
  regional_price_enabled,
  median_zip_price,
  median_availability
from edldb.chewybi.price_competitor_bungee_tech_history
where competitor_offer_date >= dateadd(day, -30, current_date())
  and zip_code is not null
  and product_part_number is not null
qualify row_number() over (
  partition by competitor_name, zip_code, product_part_number
  order by competitor_offer_date desc, created_at desc
) = 1;
