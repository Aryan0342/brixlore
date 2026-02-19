import type { Metadata } from "next";
import { SITE_BRAND } from "@/lib/seo";
import { siteService } from "@/lib/services";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for BRIXLORE.",
};

export default async function PrivacyPolicyPage() {
  const page = await siteService.getPage("privacy-policy");
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
          {page?.title || "Privacy Policy"}
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
                1. Introduction
              </h2>
              <p className="mt-2 leading-relaxed">
                {SITE_BRAND} respects your privacy. This policy explains how we
                collect, use, and protect your information.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                2. Information We Collect
              </h2>
              <p className="mt-2 leading-relaxed">
                We may collect information you provide (name, email), usage
                data, and cookies as described in our Cookie Consent page.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                3. Use and Sharing
              </h2>
              <p className="mt-2 leading-relaxed">
                We use information to provide and improve the Service. We do not
                sell your data. See Do Not Sell or Share My Personal Information
                for your choices.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                4. Your Rights and Contact
              </h2>
              <p className="mt-2 leading-relaxed">
                You may have rights to access or delete your data. For privacy
                requests, contact us via the Service.
              </p>
            </section>
          </div>
        )}
      </article>
    </main>
  );
}
