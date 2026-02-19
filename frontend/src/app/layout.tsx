import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "video.js/dist/video-js.css";
import { Providers } from "@/components/Providers";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";
import { getAppUrl } from "@/lib/env";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const baseUrl = getAppUrl();

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  icons: { icon: "/favicon.ico" },
  title: {
    default: `${SITE_NAME} — Video Streaming Platform`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: `${SITE_NAME}`,
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "BRIXLORE" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-w-0 overflow-x-hidden antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
