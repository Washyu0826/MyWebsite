import { FlatCompat } from '@eslint/eslintrc';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import storybook from 'eslint-plugin-storybook';
import prettier from 'eslint-config-prettier/flat';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
// next/core-web-vitals already binds the jsx-a11y and react-hooks plugins and a flat config may not
// bind the same plugin name twice, so the fuller rule sets are merged in as rules only. Installing
// eslint-plugin-react-hooks v7 at the root is what upgrades `react-hooks/*` to the React Compiler
// diagnostics; next on its own resolves the bundled v5 (rules-of-hooks + exhaustive-deps only).
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
      'storybook-static/**',
      'coverage/**',
      'tests/browser/**/*-snapshots/**',
      // Scratch copies and probes left at the repo root by ad-hoc tooling runs; not source.
      'zz-*',
      '.typo-check/**',
      'after/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...storybook.configs['flat/recommended'],
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // next ships this as a warning; a stale dependency array is a bug, not a style note.
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // These four React Compiler diagnostics flag 16 pre-existing patterns in components owned by
      // other workstreams (listed in docs/testing.md). Advisory until those are rewritten, then
      // promote to 'error'; the rest of the v7 set is already an error via recommended-latest.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      // Unused values are a real defect signal; the leading-underscore escape hatch stays.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // disallowTypeAnnotations stays off so inline `import('…').Type` annotations remain usable.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'Use a union of string literals or `as const` instead of an enum.',
        },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': ['error', { destructuring: 'all' }],
      'object-shorthand': ['error', 'always'],
    },
  },
  // Pre-existing accessibility findings in components owned by another workstream. Reported rather
  // than patched here; see docs/testing.md.
  {
    files: ['src/components/markdown.tsx', 'src/components/command-palette.tsx'],
    rules: {
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',
    },
  },
  // global-error.tsx replaces <html> when the root layout itself failed, so next/link — which needs
  // the router that just died — is exactly the wrong tool; a plain anchor is the point.
  { files: ['src/app/global-error.tsx', 'tests/**'], rules: { '@next/next/no-html-link-for-pages': 'off' } },
  // Config and tooling files run in Node and legitimately log.
  {
    files: [
      '*.{ts,mts,mjs,js}',
      'scripts/**',
      '.storybook/**',
      'sentry.*.config.ts',
      'instrumentation.ts',
      'tests/**',
      'src/**/*.stories.tsx',
    ],
    rules: { 'no-console': 'off' },
  },
  prettier,
];
export default config;
