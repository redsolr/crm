import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import "./globals.css";
import { QueryProvider } from "@/queries/query-provider";
import { AuthSync } from "@/queries/auth/AuthSync";
import { SettingsSync } from "@/queries/auth/SettingsSync";
import { E2EAuthInit } from "@/components/E2EAuthInit";
import { ThemeInit } from "@/components/ThemeInit";
import { TrackingProvider } from "@/components/TrackingProvider";
import { AppSplash } from "@/components/AppSplash";
import { BRAND, BRAND_KEYWORDS } from "@/lib/brand";
import { THEME_PRE_HYDRATION_SCRIPT } from "@/lib/theme";

/**
 * Mock auth mode — `MOCK_AUTH=true` (server-only env var).
 *
 * When set, we mount `<E2EAuthInit />` instead of AuthKitProvider +
 * AuthSync. Playwright injects a fake token + user into localStorage
 * via `addInitScript`, and E2EAuthInit hydrates the Zustand store.
 *
 * This is a server-only env var (no NEXT_PUBLIC_ prefix) so it never
 * leaks into the client bundle or gets cached in `.next`. Set it via:
 *   - `npm run dev:mock`  (local dev without WorkOS)
 *   - Playwright webServer.env (automatic for `npm run test:e2e`)
 */
const isMockAuth =
  process.env.MOCK_AUTH === "true" && process.env.NODE_ENV !== "production";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: {
    default: BRAND.title,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.descriptionLong,
  keywords: [...BRAND_KEYWORDS],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: BRAND.name,
    title: BRAND.title,
    description: BRAND.description,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.title,
    description: BRAND.description,
    creator: BRAND.twitter,
  },
  // Internal tool — never indexed (robots.ts disallows everything too).
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Pre-hydration theme script — runs synchronously before React mounts
          so the page doesn't flash the wrong theme on first paint. The script
          source is generated from the same constants as the rest of the
          theme system; see src/lib/theme.ts (THEME_PRE_HYDRATION_SCRIPT) for
          the source and the rationale.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PRE_HYDRATION_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeInit />
        <TrackingProvider />
        <AppSplash />
        {isMockAuth ? (
          <QueryProvider>
            <E2EAuthInit />
            <SettingsSync />
            <div className="flex w-full h-full min-h-screen">
              <div className="flex-1 flex flex-col min-h-screen">
                {children}
              </div>
            </div>
          </QueryProvider>
        ) : (
          <AuthKitProvider>
            <QueryProvider>
              <AuthSync />
              <SettingsSync />
              <div className="flex w-full h-full min-h-screen">
                <div className="flex-1 flex flex-col min-h-screen">
                  {children}
                </div>
              </div>
            </QueryProvider>
          </AuthKitProvider>
        )}
      </body>
    </html>
  );
}
