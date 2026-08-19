# Thursday manual demo checklist

Use this checklist against the integrated local `main` worktree. It validates
the user-visible workflow and the conclusion boundary; it is not a substitute
for the automated tests or owner review.

## Preflight

- Start the application with `pnpm dev` and open the local URL printed by
  the command.
- Use a new browser session or clear locally saved action packets if you need a
  clean-start test.
- Confirm the application opens on the question-entry workspace.
- For the three golden runs below, do **not** select a geography from the map.
  The golden snapshot performs its own national candidate screen; a preselected
  CBSA intentionally routes to a location-specific workflow instead.
- Capture the exact question, selected perspective, displayed snapshot/source
  IDs, and any error or surprising wording.

## 1. Question-entry experience

1. Type at least three meaningful characters such as `paid search`.
2. Confirm the menu groups matches under Recommended questions, Related
   questions, and—if packets were previously saved—Previous investigations.
3. Confirm each result shows a perspective, investigation type, and support
   state.
4. Use Arrow Down/Arrow Up, Enter, and Escape. Enter should populate the
   composer without automatically running the analysis.
5. Confirm free-form typing still works after dismissing the menu.

Pass when the typeahead is useful but never prevents an unsupported or novel
question from being entered.

## 2. Marketing — strongest live path

Select **Marketing** and ask:

> Which comparable geographies show paid-search response worth validating with first-party outcomes?

1. Choose **Run decision graph**.
2. On the plan page, confirm the geography is a national candidate screen, the
   answer is partial/bounded, and first-party outcomes and causal validity are
   visibly unresolved.
3. Choose **Confirm and run analysis**.
4. Confirm the result includes both:
   - Philadelphia-Camden-Wilmington, CBSA `37980`: 14.32% configured conversion
     rate, 1.16 percentage points above the 13.16% cohort median, $0.87 CPC.
   - San Antonio-New Braunfels, CBSA `41700`: 14.85% configured conversion rate,
     1.69 percentage points above median, $0.86 CPC.
5. Confirm the cohort is 198 eligible metropolitan CBSAs and the period is
   2026-07-14 through 2026-08-12.
6. Confirm Philadelphia's CTR is equal to the cohort median and San Antonio's
   CTR is below it. These are the required contrary signals.
7. Confirm source `SRC-018`, snapshot `google-ads-2026-07-14_2026-08-12`, and
   the no-spend/no-incrementality boundary are visible in the result or packet.
8. Save the action packet, download the decision brief, reopen the saved packet,
   and confirm the question and numbers are unchanged.

Pass when the application recommends first-party outcome and mix validation,
not a spend increase or a claim of incremental demand.

## 3. Pricing — downgrade and Zeus-boundary path

Select **Pricing** and ask:

> Where do observed competitor conditions and Chewy economics warrant investigation?

1. Run and confirm the analysis plan.
2. Confirm the result identifies Kankakee, CBSA `28100`, with 74.99% documented
   competitor availability versus a 78.07% eligible-cohort median, a -3.08
   percentage-point difference, and 4,835 monitored offer rows.
3. Confirm the result prominently states that Kankakee is supported by only one
   mapped ZIP and is a monitoring/data-quality lead.
4. Confirm the Zeus context is separately labeled **United States (national SKU
   context)** and reports 250,000 exported SKUs, 313,351 UI entries, 79.78%
   export coverage, and five current regular exceptions.
5. Confirm Zeus is not described as Kankakee demand, margin, contribution,
   inventory, or an outcome.
6. Confirm sources `SRC-025` and `SRC-036`, the competitor-observation period
   2026-07-18 through 2026-08-17, and the no-price-change boundary are preserved
   in the downloaded brief.

Pass when the single-ZIP condition is downgraded and the next step is to verify
coverage, matches, timing, and intervention state—not to change price.

## 4. CVC — research-needed path

Select **CVC** and ask:

> Which markets show demand/footprint contrasts worth deeper clinic-access investigation?

1. Run and confirm the analysis plan.
2. Confirm the result identifies the supplied trade area for Modern Animal
   Santa Clara in the San Jose-labeled cohort.
3. Confirm it reports 121,788 pet households, 49 reported veterinary clinics,
   2,485 households per clinic, 40,899.91 reported Chewy online customers, and
   a 1.43× households-per-clinic ratio versus cohort median.
4. Confirm the date is explicitly unknown, the cohort contains seven complete
   source-linked records, and the trade-area method and clinic definition are
   unresolved.
5. Confirm source `SRC-017` and the no-market-ranking/no-clinic/no-real-estate
   boundary appear in the result or packet.

Pass when the next step is GIS/CVC validation of the trade area, clinic
identity, capacity, appointments, and economics—not prioritizing Santa Clara.

## 5. Strong-action guardrails

Run these questions and confirm the support state and final answer do not
authorize the requested action:

- Pricing: `Where should Chewy change price by region?`
- Marketing: `Where should we increase paid search spend?`
- CVC: `Which markets should we prioritize for a new clinic?`

Pass when each plan says more evidence or clarification is required and the
**Confirm and run analysis** button is disabled. The product may describe the
missing evidence, but it must not execute or authorize the requested action.

## 6. Release sign-off

Record pass/fail for each item:

- [ ] Question-entry typeahead and keyboard behavior
- [ ] Marketing plan, result, saved packet, and downloaded brief
- [ ] Pricing plan, result, Zeus boundary, and downloaded brief
- [ ] CVC plan, result, research boundary, and downloaded brief
- [ ] Three strong-action guardrails
- [ ] Identical rerun produces identical values and conclusion authority
- [ ] No customer identifiers, credentials, raw source rows, or autonomous
      material actions appear anywhere in the UI or downloads
- [ ] Accountable Marketing, Pricing, CVC/GIS, and data owners reviewed the
      proposed KPI thresholds and stop rules

If any expected number, source, limitation, or authority boundary is missing,
do not present that path as release-ready. Capture the question, screenshot,
and downloaded packet and route the discrepancy for correction.
