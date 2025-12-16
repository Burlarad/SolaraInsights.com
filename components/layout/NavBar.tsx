"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { useSettings } from "@/providers/SettingsProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

const publicNavLinks = [
  { href: "/", label: "HOME" },
  { href: "/about", label: "ABOUT" },
  { href: "/learn", label: "LEARN" },
];

const protectedNavLinks = [
  { href: "/sanctuary", label: "SANCTUARY" },
  { href: "/settings", label: "SETTINGS" },
];

const languageOptions = [
  { code: "en", label: "EN", flag: "🇺🇸", name: "English" },
  { code: "es", label: "ES", flag: "🇪🇸", name: "Español" },
  { code: "fr", label: "FR", flag: "🇫🇷", name: "Français" },
  { code: "de", label: "DE", flag: "🇩🇪", name: "Deutsch" },
  { code: "pt", label: "PT", flag: "🇵🇹", name: "Português" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, saveProfile } = useSettings();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Close language menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        languageMenuRef.current &&
        !languageMenuRef.current.contains(event.target as Node)
      ) {
        setShowLanguageMenu(false);
      }
    };

    if (showLanguageMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showLanguageMenu]);

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleLanguageChange = async (languageCode: string) => {
    if (!profile) return;

    setSavingLanguage(true);
    try {
      await saveProfile({ language: languageCode });
      setShowLanguageMenu(false);
    } catch (error) {
      console.error("Failed to update language:", error);
    } finally {
      setSavingLanguage(false);
    }
  };

  // Show all nav links when authenticated, only public links when not
  const visibleNavLinks = user
    ? [...publicNavLinks, ...protectedNavLinks]
    : publicNavLinks;

  // Get current language from profile or default to English
  const currentLanguageCode = profile?.language || "en";
  const currentLanguage =
    languageOptions.find((lang) => lang.code === currentLanguageCode) ||
    languageOptions[0];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Brand pill */}
          <Link
            href="/"
            className="pill bg-gradient-to-r from-accent-gold-light to-accent-gold text-accent-ink text-xs font-semibold tracking-micro"
          >
            CLARITY FROM THE LIGHT
          </Link>

          {/* Desktop: Nav links (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-3">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "pill text-xs font-semibold tracking-wide transition-colors",
                  pathname === link.href
                    ? "bg-accent-ink text-white"
                    : "bg-white border border-border-subtle text-accent-ink hover:bg-shell"
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Auth button */}
            {!loading && (
              <>
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="pill bg-white border border-border-subtle text-accent-ink hover:bg-shell text-xs font-semibold tracking-wide flex items-center gap-2"
                  >
                    <LogOut className="h-3 w-3" />
                    SIGN OUT
                  </button>
                ) : (
                  <Link
                    href="/sign-in"
                    className="pill bg-accent-gold text-accent-ink text-xs font-semibold tracking-wide"
                  >
                    SIGN IN
                  </Link>
                )}
              </>
            )}

            {/* Language pill */}
            <div className="relative" ref={languageMenuRef}>
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                disabled={savingLanguage}
                className="pill bg-white border border-border-subtle text-accent-ink hover:bg-shell text-xs font-semibold tracking-wide flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentLanguage.flag} {currentLanguage.label}
                <ChevronDown className={cn("h-3 w-3 transition-transform", showLanguageMenu && "rotate-180")} />
              </button>

              {/* Language dropdown menu */}
              {showLanguageMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border-subtle rounded-lg shadow-lg overflow-hidden z-50">
                  {languageOptions.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      disabled={savingLanguage}
                      className={cn(
                        "w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        lang.code === currentLanguageCode
                          ? "bg-accent-soft/20 text-accent-ink font-semibold"
                          : "text-accent-ink/80 hover:bg-shell"
                      )}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <div className="flex-1">
                        <div className="font-medium">{lang.name}</div>
                        <div className="text-xs text-accent-ink/60">{lang.label}</div>
                      </div>
                      {lang.code === currentLanguageCode && (
                        <span className="text-accent-gold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Hamburger button (visible on mobile only) */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden flex items-center justify-center h-11 w-11 rounded-full bg-white border border-border-subtle text-accent-ink hover:bg-shell transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile: Sheet drawer */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent
              side="right"
              className="w-[85vw] max-w-[320px] p-0 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)]"
            >
              <SheetHeader className="px-6 pb-4 border-b border-border-subtle">
                <SheetTitle className="text-left text-lg font-semibold">
                  Menu
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col px-4 py-4">
                {/* Nav links */}
                <div className="space-y-1">
                  {visibleNavLinks.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          "flex items-center min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          pathname === link.href
                            ? "bg-accent-ink text-white"
                            : "text-accent-ink hover:bg-shell"
                        )}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </div>

                {/* Divider */}
                <div className="my-4 border-t border-border-subtle" />

                {/* Auth section */}
                {!loading && (
                  <div className="space-y-1">
                    {user ? (
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 min-h-[44px] w-full px-3 py-2 rounded-lg text-sm font-medium text-accent-ink hover:bg-shell transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    ) : (
                      <SheetClose asChild>
                        <Link
                          href="/sign-in"
                          className="flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium gradient-gold text-white"
                        >
                          Sign In
                        </Link>
                      </SheetClose>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div className="my-4 border-t border-border-subtle" />

                {/* Language section */}
                <div className="space-y-1">
                  <p className="px-3 text-xs uppercase tracking-wide text-accent-ink/60 font-semibold mb-2">
                    Language
                  </p>
                  {languageOptions.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        handleLanguageChange(lang.code);
                        setMobileMenuOpen(false);
                      }}
                      disabled={savingLanguage}
                      className={cn(
                        "flex items-center gap-3 min-h-[44px] w-full px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50",
                        lang.code === currentLanguageCode
                          ? "bg-accent-soft/30 text-accent-ink font-medium"
                          : "text-accent-ink/80 hover:bg-shell"
                      )}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="flex-1 text-left">{lang.name}</span>
                      {lang.code === currentLanguageCode && (
                        <span className="text-accent-gold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
