---
name: Compatibility alert recovery
description: Reliability rules for reporting scheduled compatibility failures through GitHub Issues
---

Retry transient failures for GitHub searches and idempotent issue updates with a small fixed limit, then fail visibly with a rerun instruction. Do not blindly retry issue creation after an ambiguous response; the request may have succeeded even if the client did not receive the response, and another create can duplicate the alert.

**Why:** Compatibility reporting must remain recoverable during GitHub outages without trading a temporary outage for duplicate maintainer alerts.

**How to apply:** When changing the compatibility reporter or workflow, preserve bounded retries for safe operations and make the workflow summary actionable when reporting cannot complete.