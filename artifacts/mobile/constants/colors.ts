/**
 * Design tokens for the game platform app.
 *
 * Dark theme is the primary experience (game aesthetic).
 * Light theme is provided as fallback.
 *
 * Special game-mode tokens:
 *  - quest: orange (#FF6B35) — used for Quest mode UI
 *  - hunt:  teal  (#00E5A0) — used for Hunt mode UI
 *
 * Use the useColors() hook to access the current scheme's tokens.
 */

const colors = {
  dark: {
    // Core surfaces
    background: '#0A0A12',
    foreground: '#F0F0FF',

    // Cards / elevated surfaces
    card: '#141420',
    cardForeground: '#F0F0FF',

    // Primary action color (buttons, links, active states) — vivid purple
    primary: '#7C5CFC',
    primaryForeground: '#FFFFFF',

    // Secondary / subtle surfaces
    secondary: '#1E1E30',
    secondaryForeground: '#A0A0C0',

    // Muted / subdued elements
    muted: '#1A1A28',
    mutedForeground: '#6B6B8A',

    // Accent (general highlight)
    accent: '#00E5A0',
    accentForeground: '#0A0A12',

    // Game-mode specific colors
    quest: '#FF6B35',
    questForeground: '#FFFFFF',
    hunt: '#00E5A0',
    huntForeground: '#0A0A12',

    // Semantic
    destructive: '#FF4D4D',
    destructiveForeground: '#FFFFFF',
    success: '#00C980',
    successForeground: '#FFFFFF',
    warning: '#FFC107',
    warningForeground: '#0A0A12',

    // Borders and input outlines
    border: '#2A2A40',
    input: '#1A1A28',

    // Legacy aliases (kept for compatibility)
    text: '#F0F0FF',
    tint: '#7C5CFC',
  },

  light: {
    background: '#FAFAFA',
    foreground: '#0A0A12',
    card: '#FFFFFF',
    cardForeground: '#0A0A12',
    primary: '#7C5CFC',
    primaryForeground: '#FFFFFF',
    secondary: '#F0F0FF',
    secondaryForeground: '#1A1A2E',
    muted: '#F0F0FF',
    mutedForeground: '#6B6B8A',
    accent: '#00C980',
    accentForeground: '#FFFFFF',
    quest: '#FF6B35',
    questForeground: '#FFFFFF',
    hunt: '#00C980',
    huntForeground: '#FFFFFF',
    destructive: '#FF4D4D',
    destructiveForeground: '#FFFFFF',
    success: '#00C980',
    successForeground: '#FFFFFF',
    warning: '#FFC107',
    warningForeground: '#0A0A12',
    border: '#E5E5F0',
    input: '#F0F0FF',
    text: '#0A0A12',
    tint: '#7C5CFC',
  },

  // Border radius (in px). Applied to cards, buttons, inputs, modals.
  radius: 12,
};

export default colors;
