---
name: RevenueCat Test Store provisioning
description: Undocumented project and product-type behavior encountered while provisioning RevenueCat through the connected API.
---

A RevenueCat project pre-created by the connector can contain no apps, including
no Test Store. The API does not permit manually creating an app with
`type: test_store`; create a normal project through the RevenueCat project API
instead, then use its automatically provisioned Test Store app.

**Why:** Attempting to create a Test Store app directly returns a provider
parameter error even though Test Store products require an app. A newly created
project immediately includes the required app.

**How to apply:** Reuse a named product project when present. If the attached
placeholder project has no apps, create the named project before seeding the
catalog. Test Store one-time products use `consumable` or `non_consumable`, not
the generic `one_time` type.