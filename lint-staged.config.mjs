/**
 * lint-staged config — runs only on files staged for the current commit.
 *
 * **Why a JS config (not a `package.json` field):** the `tsc` invocation
 * deliberately ignores the staged file list. lint-staged passes file paths
 * as positional args by default; if you do that with `tsc <files>` it will
 * silently ignore your `tsconfig.json` (TypeScript treats positional args
 * as "compile these files standalone, ignore project config"). The fix
 * documented by lint-staged is to use a function that returns a fixed
 * command without the file list — which only works in a JS config file.
 *
 * **What runs on each commit:**
 *
 *   1. ESLint with --cache --concurrency=auto on the staged TS/JS/JSX/TSX
 *      files only. The file list is appended automatically by lint-staged.
 *
 *   2. tsc --noEmit on the WHOLE project (cross-file type errors can't be
 *      detected from one file alone). Driven by `--incremental` so warm
 *      runs are ~0.5s instead of ~1.8s.
 *
 * Sources:
 *   - https://github.com/lint-staged/lint-staged#advanced-configuration
 *   - https://github.com/lint-staged/lint-staged#example-run-tsc-on-changes-to-typescript-files-but-do-not-pass-any-filename-arguments
 */

export default {
  // ESLint on staged TS/JS files under src/. lint-staged appends the staged
  // file list to this command automatically. --concurrency=1 (not auto):
  // the type-aware rule tier (2026-08-07) loads a full TS program per
  // worker, and auto-spawned workers running next to the parallel tsc
  // task OOM'd the pre-commit hook (SIGKILL) on a cold cache. One worker
  // is plenty for a staged-file list. --max-warnings=0: the baseline is
  // 0 warnings — keep it there.
  'src/**/*.{ts,tsx,js,jsx,mjs,cjs}':
    'eslint --cache --cache-location node_modules/.cache/eslint/ --cache-strategy content --concurrency=1 --max-warnings=0',

  // Whole-project tsc — runs whenever ANY .ts/.tsx file is staged anywhere
  // in the repo (root tsconfig.json, src/, e2e/). Function form so
  // lint-staged does NOT append the staged file list — passing positional
  // file arguments to `tsc` makes it treat them as standalone files and
  // silently ignore tsconfig.json. The function receives the staged file
  // list but we deliberately drop it.
  '**/*.{ts,tsx,mts,cts}': () => 'tsc --noEmit',
};
