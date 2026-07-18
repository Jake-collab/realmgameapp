// @ts-check
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'scripts/**',
      'server/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Prevent accidental console.log in production
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Enforce explicit return types on exported functions
      // (relaxed for React components — TypeScript inference is sufficient)
      'no-unused-vars': 'off', // handled by TypeScript
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
]);
