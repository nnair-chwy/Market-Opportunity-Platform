-- Metadata only. Run before expanding a query or using SELECT *.
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
from edldb.information_schema.columns
where (table_schema = 'CHEWYBI' and table_name in (
    'PRICE_COMPETITOR_BUNGEE_TECH_HISTORY',
    'PRICE_CHEWY_HISTORY',
    'PRODUCTS'
  ))
  or (table_schema = 'PRICING_ANALYTICS_MSS_SANDBOX'
      and table_name = 'PRICING_SELF_SERVICE_DASHBOARD')
  or (table_schema = 'ECOM' and table_name = 'ORDER_LINE')
order by table_schema, table_name, ordinal_position;
