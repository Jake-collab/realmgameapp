/**
 * Design tokens — Worlds
 *
 * Visual direction: deep blue + natural green palette.
 * Suggests exploration, earth, movement, discovery, technology.
 *
 * Light mode is the primary experience.
 * Dark mode tokens are fully defined for future activation.
 *
 * Game-mode specific colors:
 *   quest: warm adventure orange (#F97316)
 *   hunt:  forest green (#059669)
 *
 * Usage: always via the useColors() hook — never hardcode hex values.
 */

const colors = {
  // ─── Light Theme (primary) ────────────────────────────────────────────────

  light: {
    // Surfaces
    background: '#F8FAFC',        // soft blue-white
    foreground: '#111827',        // near-black charcoal

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#111827',

    // Primary — deep exploration blue
    primary: '#1D4ED8',
    primaryForeground: '#FFFFFF',

    // Secondary / subtle tinted surfaces
    secondary: '#EFF6FF',         // very pale blue
    secondaryForeground: '#1E3A8A',

    // Muted / subdued elements
    muted: '#F1F5F9',
    mutedForeground: '#64748B',

    // Accent — natural exploration green
    accent: '#16A34A',
    accentForeground: '#FFFFFF',

    // Game-mode specific
    quest: '#F97316',             // warm adventure orange
    questForeground: '#FFFFFF',
    hunt: '#059669',              // forest green
    huntForeground: '#FFFFFF',

    // Semantic states
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    success: '#16A34A',
    successForeground: '#FFFFFF',
    warning: '#D97706',
    warningForeground: '#FFFFFF',
    info: '#0284C7',
    infoForeground: '#FFFFFF',

    // Structure
    border: '#E2E8F0',
    input: '#F8FAFC',
    inputBorder: '#CBD5E1',

    // Legacy aliases
    text: '#111827',
    tint: '#1D4ED8',
  },

  // ─── Dark Theme (future) ──────────────────────────────────────────────────

  dark: {
    // Surfaces — deep navy, not pure black
    background: '#0F172A',        // slate-900
    foreground: '#F1F5F9',

    // Cards
    card: '#1E293B',              // slate-800
    cardForeground: '#F1F5F9',

    // Primary — lighter blue for dark backgrounds
    primary: '#3B82F6',           // blue-500
    primaryForeground: '#FFFFFF',

    // Secondary
    secondary: '#1E293B',
    secondaryForeground: '#94A3B8',

    // Muted
    muted: '#0F172A',
    mutedForeground: '#64748B',

    // Accent — brighter green for dark backgrounds
    accent: '#22C55E',            // green-500
    accentForeground: '#0F172A',

    // Game-mode specific
    quest: '#FB923C',             // orange-400
    questForeground: '#FFFFFF',
    hunt: '#34D399',              // emerald-400
    huntForeground: '#0F172A',

    // Semantic states
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    success: '#22C55E',
    successForeground: '#FFFFFF',
    warning: '#F59E0B',
    warningForeground: '#0F172A',
    info: '#38BDF8',
    infoForeground: '#0F172A',

    // Structure
    border: '#334155',            // slate-700
    input: '#1E293B',
    inputBorder: '#475569',

    // Legacy aliases
    text: '#F1F5F9',
    tint: '#3B82F6',
  },

  // ─── Border radius ────────────────────────────────────────────────────────
  // Applied to cards, buttons, inputs, modals.
  radius: 12,
} as const;

export type ColorScheme = typeof colors.light;
export default colors;
