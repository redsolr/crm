/**
 * Custom ESLint rule: `no-silent-catch`
 *
 * Forbids `catch` blocks that don't observably log or report the error.
 *
 * This enforces CLAUDE.md's "never swallow errors silently" rule. The default
 * `no-empty` rule catches `catch {}` and `catch (e) {}`, but it lets through
 * the more common silent failure: a catch block that does state mutation
 * without logging the underlying error, e.g.
 *
 *     try {
 *       await thing();
 *     } catch {
 *       setError("Something went wrong");  // ← swallowed: no log of `err`
 *     }
 *
 * A catch block passes this rule if its body contains at least one of:
 *   - `console.error(...)` / `console.warn(...)` / `console.log(...)`
 *   - `<anything>.logger.error(...)` / `.warn(...)` / `.log(...)` / `.debug(...)`
 *   - `Sentry.captureException(...)` / `Sentry.captureMessage(...)`
 *   - `throw ...` (re-throwing is fine — caller will handle)
 *   - `return Promise.reject(...)` (propagates)
 *
 * If you intentionally want to swallow an error (rare — usually only for
 * cleanup that may legitimately fail), use a one-line `// eslint-disable-next-line no-silent-catch`
 * with a comment explaining WHY.
 */

const LOG_OBJECT_NAMES = new Set([
  'console',
  'logger',
  'this',
  'Sentry',
]);

const LOG_METHOD_NAMES = new Set([
  'error',
  'warn',
  'log',
  'debug',
  'info',
  'fatal',
  'captureException',
  'captureMessage',
]);

/**
 * Recursively check whether `node` (a Statement or Expression) contains any
 * call expression that looks like a logger / Sentry / re-throw / re-reject.
 */
function containsLoggingCall(node) {
  if (!node || typeof node !== 'object') return false;

  // Re-throwing is fine: `throw err` propagates the error.
  if (node.type === 'ThrowStatement') return true;

  // `return Promise.reject(...)` propagates.
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.object?.name === 'Promise' &&
    node.callee.property?.name === 'reject'
  ) {
    return true;
  }

  // Logger / console / Sentry method call: `<obj>.<method>(...)`
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.property?.type === 'Identifier' &&
    LOG_METHOD_NAMES.has(node.callee.property.name)
  ) {
    const obj = node.callee.object;
    // Direct: console.error, Sentry.captureException
    if (obj?.type === 'Identifier' && LOG_OBJECT_NAMES.has(obj.name)) {
      return true;
    }
    // Nested: this.logger.error, foo.logger.error
    if (
      obj?.type === 'MemberExpression' &&
      obj.property?.type === 'Identifier' &&
      obj.property.name === 'logger'
    ) {
      return true;
    }
    // Member chain ending in `.error`/`.warn` etc. on `this` or any identifier
    // we treat as a logger if the receiver chain *ends* in `.logger`.
    // Already covered above; fall through.
  }

  // Recurse into all child nodes.
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (containsLoggingCall(c)) return true;
      }
    } else if (child && typeof child === 'object' && child.type) {
      if (containsLoggingCall(child)) return true;
    }
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow catch blocks that swallow errors without logging or rethrowing',
    },
    schema: [],
    messages: {
      silentCatch:
        "This catch block doesn't log or rethrow the error. Add console.error / this.logger.error / Sentry.captureException, or rethrow. To intentionally swallow, use `// eslint-disable-next-line no-silent-catch` with a reason.",
    },
  },
  create(context) {
    return {
      CatchClause(node) {
        // Skip empty body — already covered by `no-empty`.
        if (!node.body || node.body.body.length === 0) return;

        if (!containsLoggingCall(node.body)) {
          context.report({ node, messageId: 'silentCatch' });
        }
      },
    };
  },
};

export default {
  rules: {
    'no-silent-catch': rule,
  },
};
