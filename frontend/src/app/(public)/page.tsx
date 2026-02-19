import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  SITE_BRAND,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  absoluteUrl,
} from "@/lib/seo";
import { parseBranding } from "@/lib/branding";
import { siteService } from "@/lib/services";

export const metadata: Metadata = {
  title: "Watch & Discover Video Content",
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  openGraph: {
    title: `${SITE_BRAND} — Watch & Discover Video Content`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    type: "website",
  },
  twitter: {
    title: `${SITE_BRAND} — Watch & Discover Video Content`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: absoluteUrl("/"),
  },
};

function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_BRAND,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/browse")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function Home() {
  const brandingPage = await siteService.getPage("branding");
  const branding = parseBranding(brandingPage?.content ?? "");
  const bannerSrc = branding.bannerUrl?.trim() || "/hero-banner.png";
  const bannerVideoSrc = branding.bannerVideoUrl?.trim() || null;
  const heroVideoId = "TEjHDF9QXTY";
  const heroVideoSrc = `https://www.youtube.com/embed/${heroVideoId}?autoplay=1&mute=1&loop=1&playlist=${heroVideoId}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1`;
  return (
    <main className="flex flex-1 flex-col">
      <WebSiteJsonLd />

      {/* Full-screen hero: banner image + optional video (uploaded or YouTube) */}
      <section
        className="relative flex min-h-[100dvh] w-full max-w-full flex-col items-center justify-center overflow-hidden px-4 py-16"
        aria-label="Hero"
      >
        <div className="absolute inset-0">
          <Image
            src={bannerSrc}
            alt=""
            fill
            priority
            className="absolute inset-0 h-full w-full object-cover object-center"
            sizes="100vw"
            unoptimized
          />
          {bannerVideoSrc ? (
            <div className="absolute inset-0 overflow-hidden" aria-hidden>
              <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                src={bannerVideoSrc}
                title="Hero background video"
              />
            </div>
          ) : (
            <div className="absolute inset-0 overflow-hidden" aria-hidden>
              <iframe
                className="absolute left-1/2 top-1/2 h-[56.25vw] w-[177.78vh] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
                src={heroVideoSrc}
                title="Hero background video"
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-black/35" aria-hidden />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          {/* <div className="relative mb-8">
            <Image
              src="/logo.png"
              alt={SITE_BRAND}
              width={280}
              height={96}
              className="h-20 w-auto object-contain sm:h-24"
              priority
            />
          </div> */}
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl lg:text-6xl">
            Your Digital Home for Urban Storytelling
          </h1>
          <p className="mt-4 max-w-xl text-center text-lg text-white/90 drop-shadow-md">
            Join Brixlore and step into stories shaped by culture
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/browse"
              className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-foreground shadow-accent-glow transition-colors hover:bg-accent/90"
            >
              Browse content
            </Link>
            <Link
              href="/subscription"
              className="rounded-lg border-2 border-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/10"
            >
              View plans
            </Link>
          </div>
        </div>
      </section>

      {/* Upsell section below the fold */}
      <div className="flex flex-1 flex-col items-center px-4 py-16">
        {/* Upsell banner */}
        <section
          className="mt-16 w-full max-w-3xl rounded-2xl border border-neutral-700/50 bg-neutral-900/50 px-6 py-8 sm:px-8 sm:py-10"
          aria-labelledby="upsell-heading"
        >
          <h2
            id="upsell-heading"
            className="text-center text-xl font-bold text-white sm:text-2xl"
          >
            Upgrade for more
          </h2>
          <ul
            className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6"
            aria-label="Subscription benefits"
          >
            <li className="flex flex-col items-center text-center">
              <span className="text-2xl sm:text-3xl" aria-hidden>
                🎁
              </span>
              <span className="mt-2 font-semibold text-white">
                Free trial offer
              </span>
              <span className="mt-1 text-sm text-neutral-400">
                Try premium free for 7–14 days. No commitment.
              </span>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="text-2xl sm:text-3xl" aria-hidden>
                ✨
              </span>
              <span className="mt-2 font-semibold text-white">
                Ad-free viewing
              </span>
              <span className="mt-1 text-sm text-neutral-400">
                Watch without interruptions.
              </span>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="text-2xl sm:text-3xl" aria-hidden>
                🚀
              </span>
              <span className="mt-2 font-semibold text-white">
                Early access to new content
              </span>
              <span className="mt-1 text-sm text-neutral-400">
                Be first to stream new releases.
              </span>
            </li>
          </ul>
          <div className="mt-8 flex justify-center">
            <Link
              href="/subscription"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-accent-glow transition-colors hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-off-black"
              aria-label="Compare subscription plans"
            >
              Compare plans
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
