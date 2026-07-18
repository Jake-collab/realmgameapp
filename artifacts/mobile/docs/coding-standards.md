# Coding Standards

## TypeScript

- **Strict mode is enabled** — no `any`, no implicit `any`, no unused variables.
- Always declare types explicitly for `useState`: `useState<User | null>(null)`
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of manual null checks.
- Prefer `interface` for object shapes; `type` for unions, aliases, and mapped types.
- Export types from their owning files; avoid re-exporting from index barrel files.

## React Native

- **No magic numbers** — import from `constants/spacing.ts` or `constants/typography.ts`.
- **No hardcoded colors** — always use `useColors()` hook.
- **No `console.log` in production code** — use `console.warn` / `console.error` only.
- All text visible on screen must use `fontFamily` from `constants/typography.ts`.
- Safe area insets via `useSafeAreaInsets()` — never hardcode pixel offsets.
- Use `StyleSheet.create()` for all styles; avoid inline style objects in render functions.

## Component Patterns

```tsx
// ✅ Good
export function MyComponent({ title, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], borderRadius: radius.md },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg },
});

// ❌ Avoid
export function MyComponent({ title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 16, backgroundColor: '#141420' }}>
      <Text style={{ fontSize: 18, color: '#F0F0FF' }}>{title}</Text>
    </TouchableOpacity>
  );
}
```

## Imports

Use the `@/` alias for all project-relative imports:

```ts
// ✅
import { useColors } from '@/hooks/useColors';
import { spacing } from '@/constants/spacing';

// ❌
import { useColors } from '../../hooks/useColors';
```

Import order (enforced by Prettier):
1. React / React Native
2. Expo packages
3. Third-party libraries
4. `@workspace/*` packages
5. `@/` app-local imports
6. Relative imports

## Service Layer Rules

- Never call `supabase` directly from components or route files.
- All DB access goes through `services/database.service.ts`.
- All auth operations go through `services/auth.service.ts`.
- All file operations go through `services/storage.service.ts`.
- Use `useAuth()` hook (not `AuthProvider` directly) in components.

## Forms

All forms use React Hook Form + Zod:

```ts
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

const { control, handleSubmit } = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

## NativeWind Status

NativeWind is installed but not yet activated due to tailwind version conflicts.
To activate (when ready):
1. `pnpm --filter @workspace/mobile add tailwindcss@~3 --save-dev`
2. Update `babel.config.js` to add `'nativewind/babel'` preset
3. Update `metro.config.js` to wrap with `withNativeWind`
4. Create `global.css` and import in `app/_layout.tsx`

Until then, use `StyleSheet.create()` + design tokens (fully equivalent).

## File Size

Keep files under ~200 lines. If a component grows beyond that, extract sub-components into the same file (using non-exported functions) or a sibling file.
