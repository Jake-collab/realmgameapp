---
name: NVIDIA Quest output boundary
description: Non-obvious behavior observed while integrating hosted Nemotron Quest generation.
---

The NVIDIA hosted adapter can return a successful small JSON response while a
full Quest-generation prompt either echoes the input-data object, returns
surrounding prose, or takes long enough to hit the generation timeout. Keep
provider output untrusted: parse conservatively, select only an object that
passes the generated Quest schema and deterministic safety review, and fail
closed otherwise.

**Why:** A successful HTTP response is not evidence that the model produced a
publishable Quest. Relaxing validation would allow echoed inputs or malformed
content into the review pipeline.

**How to apply:** Keep provider smoke tests separate from full schema-gated
generation tests. Treat a failing full-generation probe as a provider
compatibility issue, not as a reason to bypass QVAC/QAVS or review boundaries.