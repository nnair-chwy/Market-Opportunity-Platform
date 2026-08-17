-- Read-only validation for the curated sources used by Phoenix Pricing.
-- Keep the lookbacks explicit so row counts remain reproducible.

select
  'daily_competitor_coverage_snapshot' as source,
  max(snapshot_date)::varchar as latest_date,
  count(*) as row_count,
  count(distinct product_part_number) as distinct_skus
from edldb.pricing_analytics_mss_sandbox.daily_competitor_coverage_snapshot
where snapshot_date >= current_date - 30
  and source = 'BT'

union all

select
  'pricing_labs_results_summary',
  max(start_date)::varchar,
  count(*),
  count(distinct sku)
from edldb.pricing_analytics_mss_sandbox.pricing_labs_results_summary
where start_date >= current_date - 730

union all

select
  'offer_pulsing_stats',
  max(start_date)::varchar,
  count(*),
  count(distinct product_part_number)
from edldb.pricing_analytics_mss_sandbox.offer_pulsing_stats
where start_date >= current_date - 730;
