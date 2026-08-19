-- Metadata and aggregate-only discovery for Pricing intervention controls.
-- Never select CREATED_BY, override payload values, URLs, or SKU-level rows
-- into the workspace. Payload structure and field meaning require an owner.

describe table EDLDB.CHEWYBI.DREAM_WEAVER_OVERRIDES;
describe table EDLDB.CHEWYBI.DREAM_WEAVER_LATEST_OVERRIDES;
describe table EDLDB.CHEWYBI.COMPETITOR_MATCH_BUNGEE;

select 'override_history' as dataset,
  count(*) as row_count,
  approx_count_distinct(override_id) as approximate_distinct_ids,
  null::timestamp as latest_timestamp,
  null::number as active_count
from EDLDB.CHEWYBI.DREAM_WEAVER_OVERRIDES
union all
select 'latest_overrides',
  count(*),
  approx_count_distinct(override_id),
  null::timestamp,
  null::number
from EDLDB.CHEWYBI.DREAM_WEAVER_LATEST_OVERRIDES
union all
select 'competitor_match',
  count(*),
  approx_count_distinct(competitor_match_id),
  max(match_time)::timestamp,
  count_if(coalesce(is_active, false))
from EDLDB.CHEWYBI.COMPETITOR_MATCH_BUNGEE;

-- Observed 2026-08-18:
-- override_history: 1,623,421 rows, ~11,137 distinct override IDs
-- latest_overrides: 12 rows, 12 distinct override IDs
-- competitor_match: 24,095,886 rows, ~487,753 distinct match IDs,
--   latest MATCH_TIME 2026-02-03 12:28:00
-- COMPETITOR_MATCH_BUNGEE exposes identity, competitor, active state,
-- MATCH_TIME, and DW_CREATE_DTTM but no observed reliability score.
-- DREAM_WEAVER override payloads are VARIANT and must not be interpreted until
-- the owning team's schema, effective-time, deletion, and reason semantics are
-- confirmed.
