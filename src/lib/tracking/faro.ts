"use client";

import {
  initializeFaro,
  getWebInstrumentations,
  type Faro,
} from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

let faro: Faro | null = null;

export function initFaro(): Faro | null {
  if (faro) return faro;
  if (process.env.NODE_ENV === "development") return null;
  const url = process.env.NEXT_PUBLIC_FARO_URL;
  if (!url) return null;

  faro = initializeFaro({
    url,
    app: {
      name: process.env.NEXT_PUBLIC_FARO_APP_NAME || "jurisimus-web",
      version: "1.0.0",
      environment: process.env.NEXT_PUBLIC_FARO_ENVIRONMENT || "development",
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: false,
      }),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: [
            /localhost/,
            /https:\/\/api(-dev)?\.jurisimus\.com/,
          ],
        },
      }),
    ],
  });

  return faro;
}

export function getFaro(): Faro | null {
  return faro;
}
