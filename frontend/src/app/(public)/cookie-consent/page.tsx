import type { Metadata } from "next";
import { SITE_BRAND } from "@/lib/seo";
import { siteService } from "@/lib/services";

export const metadata: Metadata = {
  title: "Cookie Consent",
  description: `Cookie and tracking preferences for ${SITE_BRAND}.`,
};

export default async function CookieConsentPage() {
  const page = await siteService.getPage("cookie-consent");
  const content = page?.content?.trim();
  const html = content
    ? /<\/?[a-z][\s\S]*>/i.test(content)
      ? content
      : content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br />")
    : "";
  return (
    <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          {page?.title || "Cookie Consent and Preferences"}
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Last updated: {new Date().toLocaleDateString("en-US")}
        </p>
        {content ? (
          <div
            className="mt-8 text-neutral-600 dark:text-neutral-300"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="mt-8 space-y-8 text-neutral-600 dark:text-neutral-300">
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                1. What Are Cookies?
              </h2>
              <p className="mt-2 leading-relaxed">
                Cookies and similar technologies are small files stored on your
                device when you use {SITE_BRAND}. They help remember your
                preferences, keep you signed in, and improve performance and
                analytics.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                2. Types of Cookies We Use
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-2 leading-relaxed">
                <li>
                  <strong className="text-neutral-800 dark:text-neutral-200">
                    Strictly necessary:
                  </strong>{" "}
                  Required for the Service to function (e.g., authentication).
                </li>
                <li>
                  <strong className="text-neutral-800 dark:text-neutral-200">
                    Functional:
                  </strong>{" "}
                  Remember your settings (e.g., theme).
                </li>
                <li>
                  <strong className="text-neutral-800 dark:text-neutral-200">
                    Analytics:
                  </strong>{" "}
                  Help us understand how the Service is used.
                </li>
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                3. Managing Your Preferences
              </h2>
              <p className="mt-2 leading-relaxed">
                You can control non-essential cookies through your browser
                settings or any cookie banner we provide. Disabling some cookies
                may limit features.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                4. More Information
              </h2>
              <p className="mt-2 leading-relaxed">
                For details on how we use your data, see our{" "}
                <a
                  href="/privacy-policy"
                  className="font-medium text-neutral-900 underline dark:text-white"
                >
                  Privacy Policy
                </a>
                . For questions about cookies, please contact us.
              </p>
            </section>
          </div>
        )}
      </article>
    </main>
  );
}
