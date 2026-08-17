-- Intended output: competitor-price-geo_by-zip-competitor-category-30d.csv
-- Grain: ZIP x competitor x merchandise hierarchy over the last 30 days.
with product_category as (
  select
    product_part_number,
    max(product_merch_classification1) as product_merch_classification1,
    max(product_merch_classification2) as product_merch_classification2,
    max(product_merch_classification3) as product_merch_classification3
  from edldb.pricing_analytics_mss_sandbox.pricing_self_service_dashboard
  where activity_date = current_date()
    and country = 'USA'
  group by product_part_number
)
select
  c.zip_code,
  c.competitor_name,
  p.product_merch_classification1,
  p.product_merch_classification2,
  p.product_merch_classification3,
  count(*) as offer_rows,
  count(distinct c.product_part_number) as distinct_skus,
  min(c.competitor_offer_date) as first_offer_dttm,
  max(c.competitor_offer_date) as latest_offer_dttm,
  avg(c.competitor_price) as avg_competitor_price,
  avg(c.equalized_price) as avg_equalized_price,
  count_if(c.coupon is not null) as coupon_rows,
  count_if(c.competitor_item_availability in (0, 1))
    as documented_available_rows,
  count_if(c.competitor_item_availability not in (0, 1)
    or c.competitor_item_availability is null) as other_availability_rows
from edldb.chewybi.price_competitor_bungee_tech_history c
left join product_category p
  on c.product_part_number = p.product_part_number
where c.zip_code is not null
  and c.competitor_offer_date >= dateadd(day, -30, current_date())
group by 1, 2, 3, 4, 5;
