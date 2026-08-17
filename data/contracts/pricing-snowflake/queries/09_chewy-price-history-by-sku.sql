-- Intended output: chewy-price-history_by-sku-90d.csv
-- Grain: SKU over the last 90 days.
select
  product_part_number,
  count(*) as price_records,
  min(price_chewy_offer_dttm) as first_offer_dttm,
  max(price_chewy_offer_dttm) as latest_offer_dttm,
  min(price_chewy_price) as min_chewy_price,
  max(price_chewy_price) as max_chewy_price,
  avg(price_chewy_price) as avg_chewy_price,
  max_by(price_chewy_price, price_chewy_offer_dttm) as latest_chewy_price,
  max_by(price_chewy_suggested_price, price_chewy_offer_dttm)
    as latest_suggested_price,
  max_by(price_chewy_map_price, price_chewy_offer_dttm) as latest_map_price,
  max_by(price_chewy_list_price, price_chewy_offer_dttm) as latest_list_price,
  max_by(price_driver, price_chewy_offer_dttm) as latest_price_driver,
  max_by(price_driver_description, price_chewy_offer_dttm)
    as latest_price_driver_description,
  count_if(is_map_break) as map_break_records
from edldb.chewybi.price_chewy_history
where product_part_number is not null
  and price_chewy_offer_dttm >= dateadd(day, -90, current_date())
group by product_part_number;
