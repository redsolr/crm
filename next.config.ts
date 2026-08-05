import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
import FaroSourceMapUploaderPlugin from "@grafana/faro-webpack-plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // jose ships ESM-only; listing it here makes next/jest transpile it
  // for the CJS test runtime (the jest suites that exercise the MCP
  // OAuth layer import it). The app build handles ESM natively either
  // way — this line exists for jest.
  transpilePackages: ["jose"],
  // Public MCP endpoint: agents connect to the clean /mcp URL
  // (Attio-style); the handler physically lives at
  // app/api/mcp/[transport] (mcp-handler's required layout).
  async rewrites() {
    return [{ source: "/mcp", destination: "/api/mcp/mcp" }];
  },
  // Remote-MCP CORS: browser-based MCP clients call /mcp and the
  // OAuth discovery routes cross-origin. Authorization must be
  // allowed (bearer tokens), Mcp-Session-Id exposed (transport
  // handshake), and the well-known metadata publicly readable.
  async headers() {
    const mcpCors = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      {
        key: "Access-Control-Allow-Methods",
        value: "GET, POST, DELETE, OPTIONS",
      },
      {
        key: "Access-Control-Allow-Headers",
        value: "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
      },
      { key: "Access-Control-Expose-Headers", value: "Mcp-Session-Id" },
    ];
    return [
      { source: "/mcp", headers: mcpCors },
      { source: "/api/mcp/:transport", headers: mcpCors },
      { source: "/.well-known/oauth-protected-resource", headers: mcpCors },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        headers: mcpCors,
      },
    ];
  },
  // The e2e webServer sets NEXT_DIST_DIR=.next-e2e so its `next dev`
  // can run ALONGSIDE a developer's dev server — two instances can't
  // share .next (build lock), which is what used to force the suites
  // to kill the :3100 dev server every run.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {},
  images: {
    remotePatterns: [
      // Country flags (used in CountrySelect)
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
  webpack: (config, { isServer }) => {
    // Upload source maps to Grafana Faro in production builds only
    if (
      !isServer &&
      process.env.NODE_ENV === "production" &&
      process.env.GRAFANA_FARO_API_KEY
    ) {
      config.plugins.push(
        new FaroSourceMapUploaderPlugin({
          appName: process.env.NEXT_PUBLIC_FARO_APP_NAME || "jurisimus-web-dev",
          endpoint: "https://faro-api-prod-us-east-3.grafana.net/faro/api/v1",
          appId: "220",
          stackId: "1544965",
          apiKey: process.env.GRAFANA_FARO_API_KEY,
          gzipContents: true,
        }),
      );
    }
    return config;
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV !== "production",
});

export default withSentryConfig(withSerwist(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "officialfindeverything",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
