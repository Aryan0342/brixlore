"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts";
import { fetchBranding } from "@/lib/branding";
import { getLoginOrigin } from "@/lib/mock-auth";
import { Button } from "@/components/ui";

const LOGO_HEIGHT = 80;
const LOGO_WIDTH = 140;

function NavContent({
  dashboardHref,
  isAuthenticated,
  isSubscribed,
  isAdmin,
  user,
  logout,
  onLinkClick,
  variant = "desktop",
  isWatchPage = false,
}: {
  dashboardHref: string;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isAdmin: boolean;
  user: { name: string; email: string } | null;
  logout: () => void;
  onLinkClick?: () => void;
  variant?: "desktop" | "mobile";
  isWatchPage?: boolean;
}) {
  const isMobile = variant === "mobile";
  const linkClass = isMobile
    ? "w-full rounded-md px-3 py-2 text-base text-neutral-200 transition-colors hover:bg-neutral-800/70 hover:text-white"
    : "hover:text-accent transition-colors text-neutral-300";
  const pillClass = isMobile
    ? "w-full rounded-md border border-accent/70 bg-transparent px-3 py-2 text-base font-semibold text-accent transition-colors hover:bg-accent/10"
    : "rounded-md border border-accent/70 bg-transparent px-2.5 py-1 text-sm font-semibold text-accent transition-colors hover:bg-accent/10";
  return (
    <>
      <Link href="/browse" className={linkClass} onClick={onLinkClick}>
        Browse
      </Link>
      <Link href="/subscription" className={linkClass} onClick={onLinkClick}>
        Plans
      </Link>
      {isAuthenticated && !isSubscribed && !isAdmin && !isWatchPage && (
        <Link href="/subscription" className={pillClass} onClick={onLinkClick}>
          Upgrade
        </Link>
      )}
      {isAuthenticated && user ? (
        <>
          <span
            className={
              isMobile
                ? "w-full rounded-md px-3 py-2 text-sm text-neutral-400"
                : "text-neutral-400"
            }
            title={user.email}
          >
            {user.name}
          </span>
          <Link
            href={dashboardHref}
            className={linkClass}
            onClick={onLinkClick}
          >
            Dashboard
          </Link>
          <Button
            variant="ghost"
            size="sm"
            fullWidth={isMobile}
            className={isMobile ? "justify-start" : undefined}
            type="button"
            onClick={() => {
              onLinkClick?.();
              logout();
            }}
          >
            Sign out
          </Button>
        </>
      ) : (
        <>
          <Link href="/login" className={linkClass} onClick={onLinkClick}>
            Sign in
          </Link>
          <Link href="/signup" onClick={onLinkClick}>
            <Button
              variant="outline"
              size="sm"
              type="button"
              fullWidth={isMobile}
              className={isMobile ? "justify-start" : undefined}
            >
              Sign up
            </Button>
          </Link>
        </>
      )}
    </>
  );
}

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isWatchPage = pathname?.startsWith("/watch");
  const { user, isAuthenticated, isSubscribed, isAdmin, logout } = useAuth();
  const [loginOrigin, setLoginOriginState] = useState<
    "admin" | "customer" | null
  >(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoginOriginState(user ? getLoginOrigin() : null);
  }, [user]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

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

  /** When admin signed in via /admin/login, Dashboard goes to admin panel; otherwise customer dashboard. */
  const dashboardHref =
    isAdmin && loginOrigin === "admin" ? "/admin" : "/dashboard";

  return (
    <header
      className={
        isHome
          ? "fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-transparent backdrop-blur-sm"
          : "sticky top-0 z-50 border-b border-white/10 bg-transparent backdrop-blur-sm"
      }
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between pl-0 pr-4 sm:pr-6 lg:pr-8">
        <Link
          href="/"
          className="-ml-1 flex shrink-0 items-center gap-2 text-white sm:-ml-2"
          aria-label="BRIXLORE.TV home"
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="BRIXLORE.TV"
              width={LOGO_WIDTH}
              height={LOGO_HEIGHT}
              className="h-12 w-auto object-contain"
              unoptimized
            />
          ) : (
            <Image
              src="/logo.png"
              alt="BRIXLORE.TV"
              width={LOGO_WIDTH}
              height={LOGO_HEIGHT}
              className="h-9 w-auto object-contain"
              priority
            />
          )}
        </Link>
        {/* Desktop nav: hidden on small screens to avoid overflow */}
        <nav
          aria-label="Main"
          className="hidden items-center gap-4 text-sm sm:gap-6 md:flex"
        >
          <NavContent
            dashboardHref={dashboardHref}
            isAuthenticated={isAuthenticated}
            isSubscribed={isSubscribed}
            isAdmin={isAdmin}
            user={user}
            logout={logout}
            isWatchPage={isWatchPage}
          />
        </nav>
        {/* Mobile menu button */}
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white md:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          {mobileMenuOpen ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>
      {/* Mobile nav drawer */}
      <div
        className={`fixed inset-0 top-14 z-50 md:hidden ${
          mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
          tabIndex={mobileMenuOpen ? 0 : -1}
        />
        <nav
          className={`relative mx-4 mt-4 flex flex-col gap-2 rounded-xl border border-neutral-700/70 bg-off-black p-4 text-base shadow-xl transition-opacity duration-200 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Main mobile"
        >
          <NavContent
            dashboardHref={dashboardHref}
            isAuthenticated={isAuthenticated}
            isSubscribed={isSubscribed}
            isAdmin={isAdmin}
            user={user}
            logout={logout}
            onLinkClick={() => setMobileMenuOpen(false)}
            variant="mobile"
            isWatchPage={isWatchPage}
          />
        </nav>
      </div>
    </header>
  );
}
