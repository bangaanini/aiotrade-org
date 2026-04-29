import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ExternalLink, FileText, Sparkles } from "lucide-react";
import { FooterSection } from "@/components/landing/footer-section";
import { SiteLanguageSelector } from "@/components/shared/site-language-selector";
import { navItems } from "@/components/landing/data";
import { LANDING_THEME_COOKIE, parseLandingTheme } from "@/lib/landing-theme";
import type { PublicGuidePdfPost } from "@/lib/public-guide-types";
import { translateHomepageContent, translateLandingNavItems, translatePublicGuidePdfPosts } from "@/lib/public-translations";
import { getPublishedPublicGuidePdfPosts } from "@/lib/public-guides";
import { getHomepageContent } from "@/lib/homepage-content";
import { parseSiteLanguage, SITE_LANGUAGE_COOKIE } from "@/lib/site-language";
import { getSiteSeoSettings } from "@/lib/site-seo";
import { getSupportedSiteLanguages, translateRecordStrings } from "@/lib/translatex";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSiteSeoSettings();

  return {
    title: `Panduan PDF | ${seo.siteName}`,
    description: "Kumpulan file panduan PDF resmi AIOTrade yang bisa dibuka langsung dari halaman publik.",
    openGraph: {
      description: "Kumpulan file panduan PDF resmi AIOTrade yang bisa dibuka langsung dari halaman publik.",
      title: `Panduan PDF | ${seo.siteName}`,
      type: "website",
      url: `${seo.siteUrl.replace(/\/$/, "")}/guide`,
    },
  };
}

function resolveGuideContextHref(href: string) {
  if (href === "#blog") {
    return "/blog";
  }

  if (href === "#panduan") {
    return "/guide";
  }

  if (href.startsWith("#")) {
    return `/${href}`;
  }

  return href;
}

export default async function GuidePage() {
  const cookieStore = await cookies();
  const currentLanguage = parseSiteLanguage(cookieStore.get(SITE_LANGUAGE_COOKIE)?.value);
  const landingTheme = parseLandingTheme(cookieStore.get(LANDING_THEME_COOKIE)?.value);
  const [pdfs, content, languageOptions, translatedNavItems, guideCopy] = await Promise.all([
    getPublishedPublicGuidePdfPosts(),
    getHomepageContent(),
    getSupportedSiteLanguages(),
    translateLandingNavItems(navItems, currentLanguage),
    translateRecordStrings({
      record: {
        backToHome: "Kembali ke beranda",
        ctaButton: "Masuk ke Member Area",
        ctaDescription:
          "Dapatkan akses penuh ke guide, materi member, dan alur setup yang lebih terarah setelah Anda membuat akun.",
        ctaEyebrow: "KHUSUS MEMBER",
        ctaTitle: "Akses member area untuk panduan lengkap.",
        empty: "Belum ada panduan PDF yang dipublish.",
        fallbackDescription: "File panduan resmi AIOTrade yang bisa Anda buka langsung dari halaman ini.",
        heading: "Guide PDF",
        openPdf: "Buka PDF",
        pageEyebrow: "Panduan resmi AIOTrade",
      },
      targetLanguage: currentLanguage,
    }),
  ]);
  const [translatedPdfs, translatedContent] = await Promise.all([
    translatePublicGuidePdfPosts(pdfs, currentLanguage),
    translateHomepageContent(content, currentLanguage),
  ]);
  const guideFooterNavItems = translatedNavItems.map((item) => ({
    ...item,
    href: resolveGuideContextHref(item.href),
  }));
  const guideFooterContent = {
    ...translatedContent.footer,
    guideLinks: translatedContent.footer.guideLinks.map((item) => ({
      ...item,
      href: resolveGuideContextHref(item.href),
    })),
  };

  return (
    <main className="landing-theme-scope landing-page-surface guide-page-shell min-h-screen" data-theme={landingTheme} id="top">
      <header className="guide-page-header sticky top-0 z-40 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[60px] w-full max-w-7xl items-center justify-between gap-6 px-4 sm:min-h-[70px] sm:px-8 lg:px-10">
          <Link
            className="guide-page-back-link inline-flex items-center gap-2 text-sm font-medium transition"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            {guideCopy.backToHome}
          </Link>

          <div className="flex items-center gap-3">
            <nav className="guide-page-nav no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto text-[0.82rem] sm:gap-6 sm:text-[1rem]">
              {translatedNavItems.map((item, index) => {
                const href = item.href === "#blog" ? "/blog" : item.href === "#panduan" ? "/guide" : `/${item.href}`;
                const isActive = item.href === "#panduan";

                return (
                  <div className="flex items-center gap-2 sm:gap-6" key={item.href}>
                    {index > 0 ? <span className="landing-header-divider">|</span> : null}
                    <Link
                      className="relative inline-flex whitespace-nowrap rounded-md px-2 py-2 transition duration-300 hover:text-[var(--landing-header-active-text)] sm:px-3"
                      href={href}
                      style={
                        isActive
                          ? {
                              color: item.accent,
                              textShadow: `0 0 18px ${item.accent}22`,
                            }
                          : undefined
                      }
                    >
                      <span>{item.label}</span>
                      {isActive ? (
                        <span
                          className="absolute inset-x-2 bottom-0 h-[2px] rounded-full sm:inset-x-3"
                          style={{
                            backgroundColor: item.accent,
                            boxShadow: `0 0 18px ${item.accent}73`,
                          }}
                        />
                      ) : null}
                    </Link>
                  </div>
                );
              })}
            </nav>
            <SiteLanguageSelector
              currentLanguage={currentLanguage}
              languages={languageOptions}
              variant="landing"
            />
          </div>
        </div>
      </header>

      <section className="guide-page-hero relative overflow-hidden px-6 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-18 lg:px-10">
        <div className="landing-hero-ambient pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 landing-hero-grid opacity-50" />
        <div className="pointer-events-none absolute left-[-7%] top-16 h-64 w-64 rounded-full blur-[110px]" style={{ background: "color-mix(in srgb, var(--landing-accent-gold) 18%, transparent)" }} />
        <div className="pointer-events-none absolute bottom-10 right-[-5%] h-72 w-72 rounded-full blur-[120px]" style={{ background: "color-mix(in srgb, var(--landing-accent-blue) 14%, transparent)" }} />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="max-w-4xl">
              <p className="guide-page-eyebrow text-[1.05rem] font-semibold tracking-[-0.02em] sm:text-[1.3rem]">
                {guideCopy.pageEyebrow}
              </p>
              <h1 className="guide-page-title mt-5 text-[3rem] font-semibold leading-none tracking-[-0.045em] sm:text-[4.45rem]">
                {guideCopy.heading}
              </h1>
              
            </div>

            
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {translatedPdfs.length ? (
              translatedPdfs.map((pdf: PublicGuidePdfPost, index: number) => (
                <article
                  className="guide-page-card relative overflow-hidden rounded-[26px] px-7 py-8 transition duration-300 hover:-translate-y-1"
                  key={pdf.id}
                >
                  <div className="guide-page-card-glow pointer-events-none absolute inset-x-0 top-0 h-24" />
                  <div className="guide-page-card-line pointer-events-none absolute inset-x-8 top-0 h-px" />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-4">
                      <div className="guide-page-card-icon inline-flex h-14 w-14 items-center justify-center rounded-[20px]">
                        <FileText className="h-6 w-6" />
                      </div>
                      <span className="guide-page-card-badge inline-flex rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em]">
                        PDF #{index + 1}
                      </span>
                    </div>

                    <h2 className="guide-page-card-title mt-6 text-[1.85rem] font-semibold leading-[1.12] tracking-[-0.04em]">
                      {pdf.title}
                    </h2>
                    <p className="guide-page-card-description mt-5 min-h-[7.5rem] text-[1rem] leading-[1.85]">
                      {pdf.description || guideCopy.fallbackDescription}
                    </p>

                    <div className="mt-7 flex items-end justify-between gap-4">
                      

                      <a
                        className="guide-page-card-button inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] px-5 text-[1rem] font-medium transition duration-300"
                        href={`/api/public-guides/pdf/${pdf.id}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {guideCopy.openPdf}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="guide-page-empty rounded-[28px] border border-dashed px-8 py-16 text-center md:col-span-2 xl:col-span-3">
                {guideCopy.empty}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 pb-18 sm:px-8 sm:pb-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="guide-page-cta-panel relative overflow-hidden rounded-[32px] px-7 py-8 text-white sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_28%)]" />
            <div className="pointer-events-none absolute -left-10 top-10 h-36 w-36 rounded-full blur-[76px]" style={{ background: "color-mix(in srgb, var(--landing-accent-gold) 18%, transparent)" }} />
            <div className="pointer-events-none absolute -right-8 bottom-4 h-40 w-40 rounded-full blur-[86px]" style={{ background: "color-mix(in srgb, var(--landing-accent-blue) 18%, transparent)" }} />

            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="guide-page-cta-badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.2em]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {guideCopy.ctaEyebrow}
                </div>
                <h2 className="mt-5 text-[2rem] font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-[2.7rem] lg:text-[3.2rem]">
                  {guideCopy.ctaTitle}
                </h2>
                <p className="mt-5 max-w-2xl text-[1rem] leading-[1.9] text-white/74 sm:text-[1.06rem]">
                  {guideCopy.ctaDescription}
                </p>
              </div>

              <div className="flex shrink-0 items-center">
                <Link
                  className="landing-button-palette-gold inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] px-6 py-3 text-[1rem] font-semibold transition duration-300 hover:-translate-y-0.5"
                  href="/signup"
                >
                  {guideCopy.ctaButton}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FooterSection
        content={guideFooterContent}
        ctaHref="/signup"
        currentLanguage={currentLanguage}
        navItems={guideFooterNavItems}
      />
    </main>
  );
}
