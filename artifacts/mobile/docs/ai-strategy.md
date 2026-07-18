# AI Strategy

> AI features are implemented in Build 6. This document defines the approach for AI agents working on that step.

## Principle: Server-Side Only

**AI API keys are NEVER exposed to the client.**

All AI calls are proxied through the Express API server (`artifacts/api-server`). The mobile app calls the API server, which calls the AI provider. This protects API keys and allows server-side rate limiting, caching, and content moderation.

```
Mobile App
  → POST /api/ai/generate-quest
    → Express API Server
      → OpenAI / Anthropic (with server-side key)
        → Response streamed back to client
```

## Environment Variables (Server-Side Only)

```bash
# In artifacts/api-server environment (NOT EXPO_PUBLIC_)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Planned AI Features

### 1. Quest Generation (Build 6)
- Input: location (lat/lng), difficulty, theme
- Output: quest title, narrative, 3-5 waypoints with clues
- Model: GPT-4o or Claude 3.5 Sonnet
- Cached per location grid cell to reduce cost

### 2. Hint System (Build 6)
- Player requests a hint for the current quest step
- Sends: current step, player's progress, number of hints used
- Receives: a contextual hint (progressively more direct with each request)
- Rate-limited: 3 hints per quest step

### 3. Narrative Content (Build 6)
- AI-generated flavor text for quest introductions
- Location-aware (pulls context from reverse geocoding)
- Tone: mysterious, adventurous, world-building

### 4. Content Moderation (Build 7)
- User-generated content (creator-submitted quests) screened by AI
- Checks for: inappropriate content, PII exposure, spam
- Moderator queue for borderline cases

## API Design (openapi.yaml additions for Build 6)

```yaml
paths:
  /ai/generate-quest:
    post:
      operationId: generateQuest
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                latitude: { type: number }
                longitude: { type: number }
                difficulty: { type: string, enum: [easy, medium, hard] }
                theme: { type: string }
  /ai/hint:
    post:
      operationId: getQuestHint
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                sessionId: { type: string }
                stepIndex: { type: number }
                hintsUsed: { type: number }
```

## Cost Management

- Cache AI responses where possible (generated quests are reusable)
- Use lower-cost models for hints (GPT-4o-mini, Claude Haiku)
- Reserve expensive models for full quest generation
- Implement rate limiting per user per day
- Monitor usage via API server logging
