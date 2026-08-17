-- Intended output: pharmacy-merch-performance_by-sku-90d.csv
-- This table is documented without geographic grain. Do not allocate it to ZIP.
select
  product_part_number,
  max(product_name) as product_name,
  max(brand) as brand,
  max(product_merch_classification1) as product_merch_classification1,
  max(product_merch_classification2) as product_merch_classification2,
  max(product_merch_classification3) as product_merch_classification3,
  min(activity_date) as first_activity_date,
  max(activity_date) as latest_activity_date,
  sum(merch_sales) as merch_sales,
  sum(net_sales) as net_sales,
  sum(units_sold) as units_sold,
  sum(non_autoship_units_sold) as non_autoship_units_sold,
  sum(autoship_units_sold) as autoship_units_sold,
  sum(total_discounts) as total_discounts,
  sum(shipping_revenue) as shipping_revenue,
  sum(product_margin) as product_margin,
  sum(gross_margin) as gross_margin,
  sum(contribution_margin) as contribution_margin,
  sum(instock_distinct_pdp_views) as instock_distinct_pdp_views,
  sum(outofstock_distinct_pdp_views) as outofstock_distinct_pdp_views,
  sum(pdp_add_to_cart) as pdp_add_to_cart,
  sum(pdp_purchases) as pdp_purchases,
  sum(return_units) as return_units,
  sum(total_impressions) as total_impressions,
  sum(total_clicks) as total_clicks,
  sum(new_customer_merch_sales) as new_customer_merch_sales
from edldb.mrch.merch_performance_snapshot_pharmacy
where activity_date >= dateadd(day, -90, current_date())
  and product_part_number is not null
group by product_part_number;
