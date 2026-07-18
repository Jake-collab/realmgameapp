/**
 * NativeWind / Tailwind CSS configuration.
 *
 * NativeWind v4 requires tailwindcss@~3 (not v4).
 * The workspace catalog pins tailwindcss to v4.x.
 *
 * To activate NativeWind:
 *   1. Install the correct tailwindcss version:
 *        pnpm --filter @workspace/mobile add tailwindcss@~3 --save-dev
 *   2. Enable the babel preset in babel.config.js:
 *        presets: [['babel-preset-expo'], 'nativewind/babel']
 *   3. Enable the metro plugin in metro.config.js:
 *        const { withNativeWind } = require('nativewind/metro');
 *        module.exports = withNativeWind(config, { input: './global.css' });
 *   4. Create global.css with @tailwind base/components/utilities directives.
 *   5. Import global.css in app/_layout.tsx.
 *
 * Until then, components use React Native StyleSheet (fully functional).
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0A0A12',
        foreground: '#F0F0FF',
        primary: '#7C5CFC',
        secondary: '#1E1E30',
        accent: '#00E5A0',
        quest: '#FF6B35',
        hunt: '#00E5A0',
        destructive: '#FF4D4D',
        success: '#00C980',
        border: '#2A2A40',
        muted: '#1A1A28',
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '6px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [],
};
