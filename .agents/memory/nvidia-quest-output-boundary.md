---
name: NVIDIA Quest output boundary
description: Non-obvious behavior observed while integrating hosted Nemotron Quest generation.
---

The NVIDIA hosted adapter can return a successful small JSON response while a
full Quest-generation prompt either echoes the input-data object, returns
surrounding prose, or spends the output budget on reasoning. Keep provider
output untrusted: parse conservatively, select only an object that passes the
generated Quest schema and deterministic safety review, and fail closed
otherwise.

**Why:** A successful HTTP response is not evidence that the model produced a
publishable Quest. Relaxing validation would allow echoed inputs or malformed
content into the review pipeline.

**How to apply:** For Nemotron 3.5 Lightning, disable thinking through the
server-side chat template control, use deterministic temperature by default,
and keep provider smoke tests separate from full schema-gated generation tests.

The completion pipeline records safe attempt metadata, retries malformed or
unsafe output with bounded corrective prompts, normalizes only observed aliases,
rejects unknown fields, and fails closed without synthesizing candidates.

**Why:** On 2026-09-09 the endpoint accepted JSON-object controls but the model
did not reliably enforce them. Explicit type contracts plus disabled reasoning
produced five consecutive schema- and safety-valid runs for Daily, Monthly,
and Geo without weakening validation.

**How to apply:** Keep strict validation, duplicate detection, server-only
credentials, durable audit attempts, and human review gates intact. Treat model
catalog presence as insufficient until the chat endpoint returns a callable,
schema-valid result.