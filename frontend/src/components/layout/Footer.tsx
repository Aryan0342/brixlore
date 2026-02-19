"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchBranding } from "@/lib/branding";

export function Footer() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchBranding()
      .then((branding) => {
        if (!active) return;
        setLogoUrl(branding.logoUrl ?? null);
      })
      .catch(() => {
        if (!active) return;
        setLogoUrl(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="border-t border-neutral-700/50 bg-off-black/95 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-300">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="BRIXLORE"
                width={100}
                height={26}
                className="h-6 w-auto object-contain opacity-90"
                unoptimized
              />
            ) : (
              <Image
                src="/logo.png"
                alt="BRIXLORE"
                width={100}
                height={26}
                className="h-6 w-auto object-contain opacity-90"
              />
            )}
            <p>© {new Date().getFullYear()} BRIXLORE. All rights reserved.</p>
          </div>
          <nav
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
            aria-label="Footer links"
          >
            <Link
              href="/browse"
              className="hover:text-accent transition-colors"
            >
              Browse
            </Link>
            <Link
              href="/contact"
              className="hover:text-accent transition-colors"
            >
              Contact us
            </Link>
            <Link
              href="/terms-of-use"
              className="hover:text-accent transition-colors"
            >
              Terms of Use
            </Link>
            <Link
              href="/privacy-policy"
              className="hover:text-accent transition-colors"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
