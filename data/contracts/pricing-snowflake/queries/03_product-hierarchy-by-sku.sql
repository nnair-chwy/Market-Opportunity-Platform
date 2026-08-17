-- Intended output: product-catalog_active-us-product-spine.csv
-- Grain: one most recently updated active U.S. catalog row per SKU.
select
  product_part_number,
  product_name,
  product_manufacturer_name,
  parent_company,
  product_merch_classification1,
  product_merch_classification2,
  product_merch_classification3,
  product_merch_classification4,
  product_attr_pet_type,
  product_attr_food_form,
  product_attr_special_diet,
  product_lifestage,
  product_lifecycle,
  product_status,
  product_rx_required_flag,
  product_is_food_flag,
  product_is_consumable_flag,
  private_label_flag,
  product_rating_avg,
  product_rating_cnt,
  product_packaged_weight,
  product_weight_uom,
  product_price_current,
  currency_code,
  cvc_published_flag,
  cvc_buyable_flag
from edldb.chewybi.products
where product_part_number is not null
  and currency_code = 'USD'
  and product_published_flag = true
  and product_discontinued_flag = false
qualify row_number() over (
  partition by product_part_number
  order by product_last_updated_dttm desc nulls last, product_key desc
) = 1;
