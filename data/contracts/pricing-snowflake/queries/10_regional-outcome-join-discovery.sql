-- Aggregate-only discovery for the regional realized-outcome path.
-- Do not select customer_address_id, source_key_id, or raw postal values.

-- Candidate outcome source discovered under role DBT_DEMO_DEVELOPER:
--   EDLDB.ECOM.ORDER_LINE
-- Candidate geography source:
--   EDLDB.CHEWY_CERTIFIED.DIM_CUSTODS_ADDRESS
-- Candidate join:
--   ORDER_LINE.CUSTOMER_ADDRESS_ID = DIM_CUSTODS_ADDRESS.SOURCE_KEY_ID

select
  count(*) as order_lines,
  count_if(a.postal_cd is not null) as postal_covered_lines,
  approx_count_distinct(a.postal_cd) as approximate_postal_codes,
  min(o.order_placed_dttm_est)::date as order_date
from EDLDB.ECOM.ORDER_LINE o
left join EDLDB.CHEWY_CERTIFIED.DIM_CUSTODS_ADDRESS a
  on o.customer_address_id = a.source_key_id
where o.order_placed_dttm_est >= dateadd(day, -2, current_date())
  and o.order_placed_dttm_est < dateadd(day, -1, current_date());

-- 2026-08-18 observation for 2026-08-16:
-- order_lines=952017, postal_covered_lines=952017,
-- approximate_postal_codes=1.
-- STATE_CD was null in a separate bounded check. The single postal value is
-- consistent with masking under the current role, not usable regional breadth.
-- The join is structurally plausible but does not yet support a regional
-- aggregate until a governed unmasked destination-geography view is published.
