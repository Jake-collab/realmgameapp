# AI Strategy

> Quest generation is server-side and review-gated. This document describes the
> current NVIDIA integration boundary; moderation, Hunt vision, and native AI
> features are separate phases.

## Principle: Server-Side Only

**AI API keys are NEVER exposed to the client.**

All Quest-generation calls are made by the Express API server
(`artifacts/api-server`). The Admin panel calls authorized server routes; the
mobile app never calls an AI provider. This protects the API key and keeps
validation, rate limits, and review state server-authoritative.

```
Admin / scheduler
  → POST /api/admin/ai/generate
    → QuestGenerationProvider
      → NVIDIA NIM chat completions
        → strict structured Quest candidate
          → validation
            → human review draft
```

## Environment Variables (Server-Side Only)

```bash
# In artifacts/api-server environment (NOT EXPO_PUBLIC_)
AI_PROVIDER=nvidia
NVIDIA_API_KEY=
AI_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
AI_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
```

`NVIDIA_API_KEY` is a Replit Secret or equivalent server-only secret. Never
place it in an `EXPO_PUBLIC_*` variable, Admin configuration, mobile code,
responses, or logs. Generation is disabled when it is absent.

## Current Quest Generation

The Admin AI Studio exposes separate Daily, Monthly, and Geo lanes through
authorized `/api/admin/ai/*` routes:

- Daily: Interest Bubble UUID inputs with fallback pool planning.
- Monthly: independent theme and target-month inputs.
- Geo: public location context and approximate area; exact coordinates remain a
  staff-review concern and are never fabricated by the model.

Every response is parsed against the server-side generated Quest schema, checked
against existing QVAC verification methods and canonical points, and stored as
`pending_review` only when an authorized admin explicitly saves it for review.
Approval does not publish a Quest or award points automatically.

## Provider and Review Design

The provider interface remains replaceable, but the default adapter is NVIDIA
NIM at `https://integrate.api.nvidia.com/v1/chat/completions` using
`nvidia/nemotron-3.5-lightning-30b-a3b`. Provider failures return safe generic
errors; 408, 429, and 5xx responses are retryable within the server retry cap.

The safe flow is:

`GENERATE → VALIDATE → PREVIEW → ADMIN EDIT → SAVE FOR REVIEW → APPROVE`

The existing Quest surfaces remain the eventual display path. The current
repository does not yet provide an automated generation scheduler or a
review-to-published-Quest promotion route; those require a later, explicit
database/API phase and must not bypass existing Quest lifecycle RPCs.

## Security and Limits

- Admin permissions gate generation, prompt editing, settings, and review.
- Generation is quota-limited and quantity-limited.
- User-derived Interest Bubble/location values are framed as untrusted data.
- No arbitrary tools, scripts, HTML, SQL, points awards, or completion decisions
  are available to the model.
- Automated moderation is not part of this integration phase.
