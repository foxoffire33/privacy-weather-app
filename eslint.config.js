// @ts-check
// Strictest-practical ESLint config for React 19 + TypeScript + Vite + MUI + Zustand.
// Designed to be enforced on AI coding agents: every rule is an error, inline
// `eslint-disable` comments are switched off entirely, and TS escape hatches are banned.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import unicorn from 'eslint-plugin-unicorn';
import importx from 'eslint-plugin-import-x';

/**
 * Promote every rule in a preset to `error`, keeping its options: nothing slips through as a warning.
 * @param {Record<string, unknown> | undefined} rules
 */
const allErrors = (rules = {}) =>
Object.fromEntries(
  Object.entries(rules).map(([name, rule]) => [
    name,
    Array.isArray(rule) ? ['error', ...rule.slice(1)] : rule === 'off' || rule === 0 ? 'off' : 'error',
  ]),
);

/**
 * Turn rules off only if this plugin version has them (unicorn renames rules between majors,
 * e.g. prevent-abbreviations -> name-replacements in v79), so the config never crashes on a missing rule.
 * @param {string[]} names
 */
const unicornOff = (names) =>
Object.fromEntries(names.filter((name) => name.replace('unicorn/', '') in (unicorn.rules ?? {})).map((name) => [name, 'off']));

// A Zustand store hook is any `useXxxStore` identifier.
const STORE_HOOK = 'CallExpression[callee.name=/^use[A-Z]\\w*Store$/]';

export default defineConfig(
  {
    // Build output and non-source folders. vite.config.ts and capacitor.config.ts sit outside the tsconfig.
    ignores: ['dist/**', 'android/**', 'scripts/**', '.idea/**', '.remember/**', 'vite.config.ts', 'capacitor.config.ts'],
  },
  {
    linterOptions: {
      // No `// eslint-disable`, `/* eslint rule: off */` or `/* global */` comments are honoured.
      // An agent cannot silence a rule; it has to fix the code. Exceptions go in this file, reviewed.
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      jsxA11y.flatConfigs.strict,
    ],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh.plugin,
      unicorn,
      'import-x': importx,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2024 },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
      'import-x/resolver': { typescript: { project: './tsconfig.json' } },
      // Let jsx-a11y check MUI buttons as real <button>s, and follow MUI's `component` prop.
      'jsx-a11y': {
        polymorphicPropName: 'component',
        components: { Button: 'button', IconButton: 'button', Fab: 'button', LoadingButton: 'button' },
      },
    },
    rules: {
      // ─── React ──────────────────────────────────────────────────────────────
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react/prop-types': 'off', // TypeScript props replace runtime prop-types.
      'react/button-has-type': 'error',
      'react/hook-use-state': 'error',
      'react/iframe-missing-sandbox': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never', propElementValues: 'always' }],
      'react/jsx-fragments': ['error', 'syntax'],
      'react/jsx-key': ['error', { checkFragmentShorthand: true, checkKeyMustBeforeSpread: true, warnOnDuplicates: true }],
      'react/jsx-no-constructed-context-values': 'error',
      'react/jsx-no-script-url': 'error',
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/jsx-pascal-case': 'error',
      'react/no-array-index-key': 'error',
      'react/no-danger': 'error',
      'react/no-invalid-html-attribute': 'error',
      'react/no-namespace': 'error',
      'react/no-object-type-as-default-prop': 'error',
      'react/no-unstable-nested-components': 'error',
      'react/no-unused-prop-types': 'error',
      'react/self-closing-comp': 'error',
      'react/void-dom-elements-no-children': 'error',

      // ─── React Hooks + React Compiler rules (all promoted to error) ─────────
      // Note: `reactHooks.configs.flat.rules` (the old spelling) is undefined in v7 and enables nothing.
      ...allErrors(reactHooks.configs.flat['recommended-latest'].rules),

                            // ─── Vite Fast Refresh: component files may only export components ─────
                            'react-refresh/only-export-components': ['error', { allowConstantExport: true }],

                            // ─── Unicorn: modern JS, all at error ───────────────────────────────────
                            ...allErrors(unicorn.configs.recommended.rules),
                            ...unicornOff([
                              // Renames React's own idioms (props, ref, e, i) to long forms; named prevent-abbreviations before v79.
                              'unicorn/prevent-abbreviations',
                              'unicorn/name-replacements',
                              'unicorn/no-null', // React uses null by design: components return null, useRef(null), "no value" state.
                                          'unicorn/consistent-destructuring', // false positives on `event.currentTarget.value` in handlers.
                                          'unicorn/filename-case', // set per file type at the bottom of this file.
                            ]),

                            // ─── Imports ────────────────────────────────────────────────────────────
                            ...importx.flatConfigs.recommended.rules,
                            ...importx.flatConfigs.typescript.rules,
                            'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
                            'import-x/first': 'error',
                            'import-x/newline-after-import': 'error',
                            'import-x/no-anonymous-default-export': 'error',
                            'import-x/no-cycle': 'error',
                            'import-x/no-duplicates': 'error',
                            'import-x/no-empty-named-blocks': 'error',
                            'import-x/no-extraneous-dependencies': 'error',
                            'import-x/no-mutable-exports': 'error',
                            'import-x/no-relative-packages': 'error',
                            'import-x/no-self-import': 'error',
                            'import-x/no-useless-path-segments': 'error',
                            'import-x/order': [
                              'error',
                              {
                                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
                            'newlines-between': 'always',
                            alphabetize: { order: 'asc', caseInsensitive: true },
                              },
                            ],

                            // ─── MUI + Zustand + React import hygiene ───────────────────────────────
                            'no-restricted-imports': 'off',
                            '@typescript-eslint/no-restricted-imports': [
                              'error',
                              {
                                paths: [
                                  {
                                    name: '@mui/material',
                            allowTypeImports: true,
                            message: 'Use path imports (import Button from \'@mui/material/Button\'). Barrel imports slow Vite dev startup. MUI ships a `path-imports` codemod.',
                                  },
                            {
                              name: '@mui/icons-material',
                            allowTypeImports: true,
                            message: 'Use default path imports (import Delete from \'@mui/icons-material/Delete\'). Named icon imports are up to 6x slower in dev.',
                            },
                            { name: '@mui/styles', message: 'Legacy JSS styling is deprecated. Use the `sx` prop or `styled` from @mui/material/styles.' },
                            { name: 'zustand', importNames: ['default'], message: 'Zustand v5 has no default export: import { create } from \'zustand\'.' },
                            { name: 'zustand/context', message: 'Removed in Zustand v5. Use a store with React context via createStore + useStore.' },
                            { name: 'react', importNames: ['default'], message: 'The automatic JSX runtime is on. Import named APIs: import { useState } from \'react\'.' },
                                ],
                            patterns: [
                              { group: ['@mui/*/*/*'], message: 'MUI imports deeper than the second level are private and can duplicate modules.' },
                            { group: ['@material-ui/*'], message: 'Material UI v4 packages are not allowed. Use @mui/*.' },
                            ],
                              },
                            ],
                            'no-restricted-syntax': [
                              'error',
                              {
                                selector: `${STORE_HOOK}[arguments.length=0]`,
                            message: 'Zustand: always pass a selector, e.g. useCityStore((s) => s.city). A bare store hook re-renders on every state change.',
                              },
                              {
                                selector: `${STORE_HOOK} > :matches(ArrowFunctionExpression, FunctionExpression) > :matches(ObjectExpression, ArrayExpression).body`,
                            message: 'Zustand v5: a selector returning a new object/array causes an infinite render loop. Select primitives separately or wrap it in useShallow().',
                              },
                              { selector: 'TSEnumDeclaration', message: 'No enums. Use a union of string literals or an `as const` object.' },
                              { selector: 'TSModuleDeclaration[kind="namespace"]', message: 'No namespaces. Use ES modules.' },
                              { selector: 'ForInStatement', message: 'No for...in. Use for...of over Object.keys/entries.' },
                              { selector: 'LabeledStatement', message: 'No labels.' },
                            ],

                            // ─── TypeScript: beyond strictTypeChecked ───────────────────────────────
                            // No escape hatches: `@ts-ignore`, `@ts-nocheck` and `@ts-expect-error` are all banned.
                            '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false }],
                            '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }],
                            '@typescript-eslint/no-unsafe-type-assertion': 'error',
                            '@typescript-eslint/consistent-type-exports': 'error',
                            // `import type { X }` (top-level) so type-only imports are always fully erased at build time.
                            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
                            '@typescript-eslint/no-import-type-side-effects': 'error',
                            '@typescript-eslint/explicit-module-boundary-types': 'error',
                            '@typescript-eslint/strict-boolean-expressions': ['error', { allowString: false, allowNumber: false, allowNullableObject: true }],
                            '@typescript-eslint/switch-exhaustiveness-check': ['error', { requireDefaultForNonUnion: true, considerDefaultExhaustiveForUnions: false }],
                            // Needs `"noUncheckedIndexedAccess": true` in tsconfig.json to avoid false positives on index access.
                            '@typescript-eslint/no-unnecessary-condition': ['error', { checkTypePredicates: true }],
                            '@typescript-eslint/prefer-readonly': 'error',
                            '@typescript-eslint/promise-function-async': 'error',
                            '@typescript-eslint/require-array-sort-compare': ['error', { ignoreStringArrays: false }],
                            '@typescript-eslint/return-await': ['error', 'in-try-catch'],
                            '@typescript-eslint/method-signature-style': 'error',
                            '@typescript-eslint/no-useless-empty-export': 'error',
                            '@typescript-eslint/no-unnecessary-qualifier': 'error',
                            '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
                            '@typescript-eslint/no-shadow': 'error',
                            '@typescript-eslint/default-param-last': 'error',
                            '@typescript-eslint/no-loop-func': 'error',
                            '@typescript-eslint/max-params': ['error', { max: 4 }],
                            '@typescript-eslint/naming-convention': [
                              'error',
                              { selector: 'typeLike', format: ['PascalCase'] },
                              { selector: 'variable', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
                              { selector: 'function', format: ['camelCase', 'PascalCase'] },
                              { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
                            ],
                            '@typescript-eslint/no-unused-vars': [
                              'error',
                              {
                                args: 'all',
                            argsIgnorePattern: '^_',
                            varsIgnorePattern: '^_',
                            caughtErrors: 'all',
                            caughtErrorsIgnorePattern: '^_',
                            destructuredArrayIgnorePattern: '^_',
                            reportUsedIgnorePattern: true,
                              },
                            ],

                            // ─── Core correctness & quality ─────────────────────────────────────────
                            'array-callback-return': ['error', { checkForEach: true }],
                            'complexity': ['error', 15],
                            'curly': ['error', 'all'],
                            'default-case-last': 'error',
                            'eqeqeq': ['error', 'always'],
                            'guard-for-in': 'error',
                            'logical-assignment-operators': 'error',
                            'max-depth': ['error', 4],
                            'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
                            'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
                            'max-nested-callbacks': ['error', 4],
                            'no-alert': 'error',
                            'no-await-in-loop': 'error',
                            'no-caller': 'error',
                            'no-console': 'error',
                            'no-constructor-return': 'error',
                            'no-debugger': 'error',
                            'no-else-return': ['error', { allowElseIf: false }],
                            'no-eval': 'error',
                            'no-extend-native': 'error',
                            'no-extra-bind': 'error',
                            'no-implicit-coercion': 'error',
                            'no-iterator': 'error',
                            'no-lone-blocks': 'error',
                            'no-multi-assign': 'error',
                            'no-nested-ternary': 'error',
                            'no-new': 'error',
                            'no-new-func': 'error',
                            'no-new-wrappers': 'error',
                            'no-object-constructor': 'error',
                            'no-octal-escape': 'error',
                            'no-param-reassign': ['error', { props: true }],
                            'no-promise-executor-return': 'error',
                            'no-proto': 'error',
                            'no-restricted-globals': ['error', { name: 'event', message: 'Use the handler argument.' }],
                            'no-return-assign': ['error', 'always'],
                            'no-script-url': 'error',
                            'no-self-compare': 'error',
                            'no-sequences': 'error',
                            'no-template-curly-in-string': 'error',
                            'no-unmodified-loop-condition': 'error',
                            'no-unneeded-ternary': 'error',
                            'no-unreachable-loop': 'error',
                            'no-useless-assignment': 'error',
                            'no-useless-call': 'error',
                            'no-useless-computed-key': 'error',
                            'no-useless-concat': 'error',
                            'no-useless-rename': 'error',
                            'no-useless-return': 'error',
                            'no-var': 'error',
                            'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' }],
                            'object-shorthand': ['error', 'always'],
                            'one-var': ['error', 'never'],
                            'operator-assignment': 'error',
                            'prefer-arrow-callback': 'error',
                            'prefer-const': 'error',
                            'prefer-exponentiation-operator': 'error',
                            'prefer-object-has-own': 'error',
                            'prefer-object-spread': 'error',
                            'prefer-regex-literals': 'error',
                            'prefer-rest-params': 'error',
                            'prefer-spread': 'error',
                            'prefer-template': 'error',
                            'radix': 'error',
                            'symbol-description': 'error',
                            'yoda': 'error',
    },
  },
  // File naming, the common React + TypeScript convention:
  // components PascalCase (CityCard.tsx), hooks camelCase starting with `use` (useCity.ts),
  // everything else camelCase (cityStore.ts, formatDate.ts). Later blocks override earlier ones.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.d.ts'],
    rules: { 'unicorn/filename-case': ['error', { case: 'camelCase', checkDirectories: false }] },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/main.tsx', 'src/**/use[A-Z]*.tsx'],
    rules: { 'unicorn/filename-case': ['error', { case: 'pascalCase', checkDirectories: false }] },
  },
  // Vite's entry point renders the app and exports nothing.
  {
    files: ['src/main.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
