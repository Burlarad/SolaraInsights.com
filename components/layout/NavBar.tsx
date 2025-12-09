"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { useSettings } from "@/providers/SettingsProvider";

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
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Brand pill */}
          <Link
            href="/"
            className="pill bg-gradient-to-r from-accent-gold-light to-accent-gold text-accent-ink text-xs font-semibold tracking-micro"
          >
            CLARITY FROM THE LIGHT
          </Link>

          {/* Center/Right: Nav links */}
          <div className="flex items-center gap-3">
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
        </div>
      </div>
    </nav>
  );
}
