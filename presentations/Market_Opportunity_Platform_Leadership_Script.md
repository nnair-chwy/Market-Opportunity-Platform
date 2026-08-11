# Market Opportunity Platform leadership script

Estimated length: 12 to 15 minutes, excluding discussion.

## Core message

The Market Opportunity Platform helps Chewy move from noticing a regional change to deciding what to do about it. It turns qualified signals into owned, time-bound action plans with clear success measures, guardrails, and stop conditions.

Bringing data and evidence together is necessary, but it is not the end product. The impact is faster, more disciplined action on regional opportunities and a measurable record of what worked, what did not, and why.

## 1. Opening

“Today, we want to show how our work evolved from a clinic location question into a broader Market Opportunity Platform.

The core idea is simple. Chewy sees changes in markets all the time: customer interest grows, clinic demand shifts, a competitor closes, service coverage changes, or a local need emerges. The challenge is not only seeing those signals. The challenge is turning the right signal into the right action while there is still time to respond.

That is the outcome we are building toward.

The platform identifies a regional change, tests it against a business playbook, and prepares a bounded action plan. That plan names the owner, the action, the deadline, the expected outcome, the guardrails, and the conditions for advancing or stopping.

The goal is not another dashboard and it is not an autonomous decision-maker. It is a repeatable way to help accountable teams move from signal to action, then learn from the result.”

## 2. Where we started

“We started with clinic location evaluation because it gave us a focused, high-value regional decision.

A clinic decision depends on local demand, current care access, property feasibility, staffing, economics, and operational constraints. No single signal answers the question. The decision requires several types of evidence, explicit rules, and expert judgment.

That work exposed a pattern that extends beyond clinics. Across the business, teams are already monitoring markets and identifying possible opportunities. What is often missing is a consistent path from an observed change to a qualified response.

The clinic use case helped us discover the broader product. The lasting capability is not a clinic score. It is a regional opportunity workflow.”

## 3. What we learned

“Our discovery showed that the hard part is not simply finding more data.

Teams need to determine whether a signal is meaningful, whether the business can responsibly act on it, who owns the response, and how success will be measured.

A demand increase is not automatically a marketing opportunity. A rise in appointment interest is not automatically a reason to expand. A competitor closure is not automatically evidence that customers will move to Chewy.

Each signal has to be tested against the conditions of a specific business decision.

That led us to a more useful product model: one shared Opportunity Inbox for a region, with separate playbooks for each business sector. The inbox creates a common way to detect, route, track, and measure opportunities. The playbooks preserve the different evidence, rules, actions, and guardrails each team needs.”

## 4. What appears in the Opportunity Inbox

“The Opportunity Inbox is not a list of interesting facts. Each card represents a business hypothesis that has passed a defined set of checks and is tied to a permitted next action.

Every card should answer seven questions:

1. What changed?
2. Why might it matter?
3. What evidence supports or challenges it?
4. What action is permitted?
5. Who owns the next step, and by when?
6. What outcome would show that the action worked?
7. What condition would block or stop it?

For this proof of concept, we built three synthetic Seattle opportunities.”

### Opportunity 1: Growth and marketing

“The first opportunity is a regional acquisition gap.

The synthetic signal shows category interest increasing while Chewy customer penetration and eligible marketing reach remain below their comparison baselines. The platform also checks whether delivery and inventory can support a test and whether recent campaign saturation or weak audience quality should block it.

The output is not ‘spend more in Seattle.’ The output is a controlled regional acquisition-test brief for Marketing review.

The proposed action is to test a bounded audience using an approved comparison or holdout design. Marketing owns the decision. Success is incremental new customers or orders. Acquisition cost, inventory, delivery readiness, and campaign saturation are guardrails. If the audience is too small, service readiness fails, or the economics do not meet the approved threshold, the test does not advance.”

### Opportunity 2: Pet Health and CVC

“The second opportunity is an awareness gap where capacity is available.

The synthetic signal shows appointment interest rising near a clinic while staffed capacity remains available and local awareness is below its comparison baseline. The playbook also checks wait times, service limitations, staffing readiness, and whether the demand is actually within the approved clinic geography.

The output is not ‘open another clinic.’ It is a set of bounded options for CVC review, such as a localized awareness test, a referral test, or a deeper capacity and service-access review.

CVC owns the decision. Success is measured through qualified bookings or completed visits. Capacity utilization, wait time, cancellations, and service availability protect the customer and clinic experience. If demand cannot be served safely or the signal sits outside the clinic’s service area, the action is blocked or stopped.”

### Opportunity 3: Market ecosystem change

“The third opportunity begins with a fictional local competitor closure.

The closure itself is only an event. Before treating it as an opportunity, the platform checks the business identity, location, permanence, effective date, source verification, local demand, replacement competition, delivery coverage, inventory, campaign saturation, and nearby clinic presence.

When all required conditions pass, the current prototype prepares a deterministic ActionPacket. In this synthetic example, the packet contains a 14-day regional acquisition and clinic-awareness test plan, a fictional accountable owner, a calculated 48-hour deadline, ordered actions, success measures, guardrails, and explicit advance and stop conditions.

The impact is speed with control. A time-sensitive market change becomes a prepared response that a team can inspect and route, instead of an alert that someone still has to interpret from scratch.

The packet does not launch a campaign, change clinic operations, or send a message. It prepares the course of action and preserves the boundary between decision support and execution.”

## 5. The impact we are trying to create

“The value of the platform is not that it puts data in one place. That is part of how it works, but it is not the business outcome.

The intended impact is to improve how Chewy responds to regional opportunities in five ways.

First, shorten the time from a meaningful market change to an accountable next step.

Second, increase the number of qualified opportunities that reach a real test or decision before they expire.

Third, reduce false starts by checking contradictions, constraints, and service readiness before a team invests effort.

Fourth, make ownership explicit by attaching each opportunity to a responsible team, a deadline, and a permitted action.

Fifth, build organizational learning by recording what action was proposed, what decision was made, what outcome occurred, and which playbook conditions should change next time.

Over time, that creates a closed loop: detect, qualify, act, measure, and improve.

The business impact still has to be proven with real pilots. We should measure time to disposition, the share of qualified opportunities acted on before expiration, experiment lift or operational outcome, guardrail performance, and the rate of stopped or blocked actions that avoided unnecessary work.”

## 6. What the current prototype proves

“The current proof of concept demonstrates this workflow with fictional synthetic evidence for Seattle.

It processes a synthetic data batch, applies deterministic validation and regional rules, creates three sector-specific opportunities, separates supporting and contradicting evidence, and prepares the next bounded workflow.

Marketing and Pet Health retain a human review step in the current design. The ecosystem example goes further and demonstrates a completed deterministic ActionPacket with an advance, blocked, or stop disposition.

The prototype can also prepare an Outlook-ready or Slack-ready preview and store a simulated receipt. Nothing is actually sent, and no business action is executed.

AI has a narrow role. It can turn a validated packet into concise stakeholder language. It cannot create evidence, change a threshold, choose a geography, alter the action plan, send a message, or make the final business decision.

The system owns the rules and calculations. Accountable people own the action and the decision.”

## 7. Demo introduction

“As you watch the demo, focus on the movement from signal to action.

We will show six steps:

1. A synthetic regional scan completes.
2. Deterministic rules qualify three sector opportunities.
3. The Opportunity Inbox routes each one to the appropriate business playbook.
4. The detail view shows the proposed action, owner, deadline, evidence, and blockers.
5. The ActionPacket defines what to do, how to measure it, and when to stop.
6. The platform prepares a stakeholder message and audit record without sending or executing anything.”

## 8. Demo talk track

### Run discovery

“We begin with the national market view and run the synthetic discovery workflow.

The application validates each observation, applies the configured regional rules, rejects or quarantines invalid inputs, suppresses duplicates, and creates only the opportunities that qualify.

This matters because the inbox should not become a stream of unfiltered alerts. A signal enters the inbox only through a defined playbook.”

### Review the opportunity list

“The Opportunity Inbox now shows three different actions for the same Seattle market.

Growth and Marketing sees a controlled acquisition-test brief.

Pet Health sees an awareness or capacity action for CVC review.

Market Ecosystem sees a prepared response to a verified local change.

They share a regional view, but they do not share one score or one decision rule. Each opportunity has its own owner, evidence requirements, permitted action, outcome, guardrails, and expiration.”

### Open the ecosystem opportunity

“Here, the platform leads with the prepared course of action, not with a wall of data.

The system disposition tells us whether the opportunity should advance, stop, or remain blocked. We can see the accountable owner and deadline, the checks already completed, any remaining blockers, and the ordered actions that have been prepared.

We can also see the conditions required to proceed and the conditions that would stop the work. That keeps a possible opportunity from turning into an open-ended project.”

### Review outcome and guardrails

“The action plan is attached to a measurable outcome and a defined measurement window.

The goal is not activity for its own sake. The team should be able to determine whether the action created incremental qualified customer or booking response relative to a versioned baseline.

At the same time, the platform preserves guardrails for acquisition cost, inventory, delivery, campaign saturation, clinic capacity, wait time, and cancellations.

This is where the product moves beyond insight. It prepares a testable response and defines what responsible success looks like before action begins.”

### Show the evidence and provenance

“The supporting evidence, contradictions, assumptions, source IDs, and calculation versions remain available underneath the plan.

They are important because the action must be traceable. But they support the decision rather than becoming the whole user experience.”

### Prepare communication

“The platform can prepare a concise Outlook-ready or Slack-ready brief from the validated packet.

In this proof of concept, the preview is simulated. No message is sent, no campaign launches, and no operational setting changes. The receipt records only that a preview was created.”

### Contrast Marketing or Pet Health

“Marketing and Pet Health currently follow a human-review workflow. A reviewer can approve the opportunity for routing, request more evidence, or dismiss it with a reason.

This distinction is deliberate. We should not assume that every sector needs the same lifecycle. The shared platform organizes the opportunity, but each business team retains control of its decision rules and action authority.”

## 9. What the platform is not

“We are not proposing a universal opportunity score.

We are not proposing an AI system that decides where Chewy should invest.

We are not treating every market signal as a business opportunity.

We are not assuming that data is approved simply because it is accessible.

We are not centralizing ownership of Marketing, CVC, Operations, or expansion decisions.

The platform creates the operating structure around an opportunity. It helps teams see the signal, evaluate it consistently, prepare the right response, and measure the result. The accountable business team retains decision and execution authority.”

## 10. Recommended pilot and leadership ask

“The next step should not be a broad production rollout. It should be one bounded regional pilot tied to a real decision and a real action.

A strong pilot needs one accountable owner, one approved playbook, a measurable baseline, approved aggregate evidence, a permitted action, a comparison or control where appropriate, a useful decision window, and clear success and stop conditions.

The leadership decision we are asking for is alignment on three points.

First, the product outcome is faster, more disciplined action on regional opportunities, not simply consolidated data.

Second, the Opportunity Inbox should support multiple business sectors through separate playbooks, while preserving clear ownership and governance.

Third, we should select one pilot where the business is prepared to act and measure the result.

That pilot should answer the question that matters most: does this workflow help a team move from a qualified market signal to a better, faster, measurable action?”

## 11. Close

“We started with a clinic decision and discovered a broader opportunity.

Chewy does not only need another way to see what is happening in a market. Teams need a reliable way to decide what the change means for them, what they can do next, who owns it, how quickly they need to respond, and how they will know whether it worked.

That is the purpose of the Market Opportunity Platform.

It turns regional signals into accountable action plans, gives teams the evidence and guardrails to act responsibly, and creates a measurable learning loop across markets and business sectors.”

## Short mission statement

“Our mission is to help Chewy turn regional market changes into timely, accountable, and measurable action across business sectors.”

## One-sentence product description

“The Market Opportunity Platform is a regional Opportunity Inbox that qualifies market signals and prepares sector-specific action plans with an owner, deadline, outcome, guardrails, and stop conditions.”
