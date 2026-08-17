-- Intended output: pse-pricing-economics_by-us-category-current-day.csv
-- Grain: current date x merchandise hierarchy x manufacturer.
select
  activity_date,
  product_merch_classification1,
  product_merch_classification2,
  product_merch_classification3,
  product_manufacturer_name,
  count(*) as sku_rows,
  count_if(min_competitor_price is not null) as skus_with_competitor_price,
  avg(chewy_pricebot_price) as avg_chewy_price,
  avg(min_competitor_price) as avg_min_competitor_price,
  avg(pse_cost) as avg_pse_cost,
  avg(raw_product_cost) as avg_raw_product_cost,
  avg(product_cost) as avg_product_cost,
  sum(units_sold) as units_sold,
  sum(net_sales) as net_sales,
  sum(total_discounts) as total_discounts,
  sum(shipping_revenue) as shipping_revenue,
  avg(elasticity) as avg_elasticity
from edldb.pricing_analytics_mss_sandbox.pricing_self_service_dashboard
where activity_date = current_date()
  and country = 'USA'
group by 1, 2, 3, 4, 5;
