"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="w-full mt-12 md:mt-24">
      <div className="gradient-footer py-6 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-accent-ink/70">
            <Link href="/privacy" className="hover:text-accent-gold transition-colors">
              {t("privacyPolicy")}
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-accent-gold transition-colors">
              {t("termsOfService")}
            </Link>
            <span>·</span>
            <Link href="/about" className="hover:text-accent-gold transition-colors">
              {t("about")}
            </Link>
          </div>
          <p className="text-center text-sm text-accent-ink/70">
            {t("copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}
