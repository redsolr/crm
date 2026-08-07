// Minimal native flat config compatible with ESLint v10.
//
// History: this used to extend `eslint-config-next` via `FlatCompat.extends()`,
// which broke in two stages:
//   1. `@eslint/eslintrc`'s config validator JSON.stringifies the loaded
//      plugins to format errors, and chokes on the circular references inside
//      `eslint-plugin-react`. Bypassed by importing the flat config directly.
//   2. `eslint-config-next@16` bundles `eslint-plugin-react@7.37` which uses
//      `context.getFilename()` — removed in ESLint v9. Loading it crashes
//      every lint run with `contextOrFilename.getFilename is not a function`.
//
// Until `eslint-plugin-react` ships a release compatible with ESLint v10+
// (tracked at jsx-eslint/eslint-plugin-react#3697), we use a minimal config
// that enables only the rules that actually work on this ESLint version:
//   - `@typescript-eslint` (works with v10)
//   - `@next/eslint-plugin-next` (works with v10)
//   - our custom `no-silent-catch` rule
//
// Lost coverage: the React-specific rules (JSX a11y, react-hooks/exhaustive-deps,
// react/no-unknown-property, etc.). These should be re-enabled the moment
// upstream catches up — search this file for "TODO(eslint-plugin-react)".
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import noSilentCatchPlugin from "./eslint-rules/no-silent-catch.mjs";

const eslintConfig = [
  // Apply TypeScript ESLint to .ts/.tsx files only.
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["**/*.{ts,tsx,mts,cts}"],
  })),
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      local: noSilentCatchPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // The react-hooks v7 strict rules and jsx-a11y raw-element rules
      // graduated warn → error on 2026-08-07 after the baseline hit 0
      // (platform doctrine: no warn tier — a warning nobody must fix
      // is a warning nobody fixes).
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "react-hooks/immutability": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/purity": "error",
      // jsx-a11y: only the rules that fire on raw HTML elements, not the
      // ones that need eslint-plugin-react's JSX context analysis.
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      // CLAUDE.md: never swallow errors silently. Every catch block must
      // log/rethrow/report. Graduated to `error` 2026-08-07 at 0-baseline
      // (matches the backend config).
      "local/no-silent-catch": "error",
      // `catch {}` and `catch (e) {}` are still hard errors — egregious form.
      "no-empty": ["error", { allowEmptyCatch: false }],
      // Backend parity: hard error, no `_` escape hatch (CLAUDE.md forbids
      // it). `args: 'none'` because framework callback signatures routinely
      // carry parameters an implementation doesn't use.
      "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
      // TODO(eslint-plugin-react): re-enable React/JSX rules once
      // eslint-plugin-react supports ESLint v10 (jsx-eslint/eslint-plugin-react#3697).
    },
  },
  // --- Platform-parity type-aware rules (the real-bug tier) -----------------
  // The backend runs typescript-eslint strictTypeChecked at `error` on a
  // 0-baseline. Adopted here 2026-08-07 (founder ask): the type-aware rules
  // that catch real bugs, scoped to authored src. Deliberately NOT adopted
  // (for now): strict-boolean-expressions (a JSX-wide truthiness sweep of
  // its own) and eslint-plugin-import (new dependency + repo-wide reorder).
  {
    files: ["src/**/*.{ts,tsx,mts,cts}"],
    // tsconfig excludes these (jest owns the tests, serwist owns sw.ts) —
    // the project service can't type them; they keep the non-type-aware
    // rule set above.
    ignores: ["src/**/__tests__/**", "src/app/sw.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true },
      ],
      "@typescript-eslint/require-array-sort-compare": "error",
      "@typescript-eslint/unbound-method": "error",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // The custom rule file is a plugin entry point — exclude from linting.
      "eslint-rules/**",
      // OpenAPI codegen output — regenerated by `npm run openapi:gen`. The
      // file already disables ESLint at the top; ignoring at the config
      // layer is cleaner and means we don't lint code we don't author.
      "src/lib/generated/**",
    ],
  },
];

export default eslintConfig;
