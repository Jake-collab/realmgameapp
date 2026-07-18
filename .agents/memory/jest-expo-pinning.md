---
name: Jest + Expo Version Pinning
description: Which Jest/jest-expo versions work with Expo SDK 54, and why testEnvironment matters.
---

## Rule
For Expo SDK 54, pin: `jest@~29.7.0` and `jest-expo@~54.0.17`. Installing the latest jest (30.x) causes version mismatch warnings and may break test compatibility.

## testEnvironment
Use `testEnvironment: 'node'` in `jest.config.js`. Without it, the `jsdom` environment causes `react-native/jest/setup.js` to fail with `SyntaxError: Cannot use import statement outside a module`.

## Config that works
```javascript
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testEnvironment: 'node',
};
```

## Mock requirements
- `@react-native-async-storage/async-storage` must be mocked in setup.ts
- `expo-splash-screen`, `expo-router`, `expo-linking`, `expo-location` all need mocks
- supabase client mocked via `jest.mock('@/lib/supabase/client', ...)`

**Why:** Installing jest without pinning to expo's expected range brings in v30+ which the current jest-expo preset doesn't support.

**How to apply:** When adding test dependencies for any future expo mobile work, always check `expo doctor` or the Expo peer requirements before installing.
