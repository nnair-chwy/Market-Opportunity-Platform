-- Intended output: pse-pricing-economics_by-us-sku-current-day.csv
-- Grain: current activity date x U.S. SKU.
-- Keep PSE, raw, and modeled costs distinct.
select
  activity_date,
  product_part_number,
  product_merch_classification1,
  product_merch_classification2,
  product_merch_classification3,
  product_manufacturer_name,
  chewy_pricebot_price,
  list_price,
  min_competitor_price,
  pse_cost,
  raw_product_cost,
  product_cost,
  net_sales,
  units_sold,
  total_discounts,
  shipping_revenue,
  elasticity,
  pricing_strategy,
  price_driver
from edldb.pricing_analytics_mss_sandbox.pricing_self_service_dashboard
where activity_date = current_date()
  and country = 'USA'
  and product_part_number is not null
qualify row_number() over (
  partition by product_part_number
  order by utc_time desc nulls last
) = 1;
