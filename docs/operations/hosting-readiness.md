# Hosting readiness

## Current shareable prototype

The stakeholder prototype may be hosted only as a private, authenticated site.
Set `REQUIRE_AUTHENTICATED_VIEWER=true` in the hosted runtime. Keep source-system
credentials and raw exports out of the deployment. The hosted site receives only
the reviewed, minimized snapshot committed for that release.

The data-refresh endpoint can inspect freshness on the hosted site, but it cannot
rebuild private data there. Snapshot rebuilding remains restricted to the secure
workstation and writes a structured audit event. Slack delivery is server-side,
fixed to one administrator-configured destination, and can be restricted with
`SLACK_FINDINGS_ALLOWED_SENDERS`.

## Company production path

Treat the private prototype as non-production. A company production release
requires the owning engineering team to provide and approve:

1. A Chewy-owned repository with protected `main`, pull-request review, quality
   gates, ownership, and the approved CI/CD library.
2. The same versioned artifact promoted through non-production environments
   before production, with UAT evidence and a change record.
3. Chewy SSO/Okta access, least-privilege roles, user attribution, periodic access
   review, and no public or unrestricted access.
4. Approved source-system service accounts using OAuth or key-pair authentication.
   Do not use shared passwords or long-lived credentials.
5. AWS Secrets Manager (or the approved equivalent) for Snowflake, OpenAI/Phoenix,
   Slack, and any other runtime secrets.
6. CloudWatch-compatible structured logs, the `/api/health` check, deployment
   notifications, rollback behavior, and an accountable application owner.
7. Data-owner approval for every source, classification of stored fields, retention
   and deletion rules, and confirmation that no unmasked PII enters the snapshot.

The documented analytics reference architecture is AWS ECS/Fargate behind an ALB
with Okta, a containerized app, CloudWatch, Secrets Manager, and governed Snowflake
access. Cloudflare or another third-party host must not be treated as company-
standard production infrastructure without an explicit security and platform
approval.

## Release evidence for this prototype

- The source commit identifies the exact release.
- The production build and focused action/output tests must pass before saving a
  hosted version.
- Hosting remains private; audience expansion requires an explicit access decision.
- A failed refresh leaves the previously published snapshot unchanged.
- Email uses the viewer's own mail client. Slack sends only after an administrator
  configures the approved destination and sender allowlist.
