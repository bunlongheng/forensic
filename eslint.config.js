import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public/tesseract']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^_' }],
      // Core no-unused-vars can't see JSX usage (<Foo/> doesn't count as a
      // reference to Foo without this) - it's what varsIgnorePattern was
      // papering over before.
      'react/jsx-uses-vars': 'error',
    },
  },
  {
    // Server-side + config + tests run under Node, not the browser.
    files: [
      'lib/**/*.js',
      'api/**/*.js',
      'db/**/*.mjs',
      'serve.mjs',
      'scripts/**/*.mjs',
      'vite.config.js',
      'vitest.config.js',
      'playwright.config.js',
      'tests/**/*.{js,jsx}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
