/**
 * Typography tokens.
 *
 * Fonts: Inter (pre-loaded via @expo-google-fonts/inter)
 * Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
 *
 * Use these tokens instead of hardcoding font sizes or weights.
 */

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  '5xl': 42,
  '6xl': 52,
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export const letterSpacing = {
  tighter: -0.8,
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 0.8,
  widest: 1.6,
} as const;

/** Pre-composed text style presets */
export const textPreset = {
  /** Hero display text */
  display: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['4xl'],
    letterSpacing: letterSpacing.tight,
  },
  /** Section headings */
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize['2xl'],
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xl,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
  },
  /** Body text */
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
  },
  /** Small / caption text */
  sm: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  smMedium: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  xs: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  /** UI labels */
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    letterSpacing: letterSpacing.wide,
  },
  /** Button text */
  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  buttonSm: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
} as const;
