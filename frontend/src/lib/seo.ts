/**
 * SEO config and helpers for the streaming platform.
 * Used by Next.js metadata API and JSON-LD.
 */

export const SITE_NAME = "BRIXLORE";
/** Full branding with .TV suffix (e.g. footer, hero). */
export const SITE_BRAND = "BRIXLORE";
export const SITE_DESCRIPTION =
  "Watch and discover video content on BRIXLORE. Browse tutorials, technical talks, and long-form sessions.";
export const SITE_KEYWORDS = [
  "video streaming",
  "streaming platform",
  "watch online",
  "video tutorials",
  "live streaming",
  "video on demand",
];

import { getAppUrl } from "@/lib/env";

/** Base URL for canonical links and Open Graph. Set NEXT_PUBLIC_APP_URL in production. */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return getAppUrl();
}

/** Absolute URL for a path (canonical, og:url). */
export function absoluteUrl(path: string): string {
  const base = getBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
