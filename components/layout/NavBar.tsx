"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";

const publicNavLinks = [
  { href: "/", label: "HOME" },
  { href: "/about", label: "ABOUT" },
  { href: "/learn", label: "LEARN" },
];

const protectedNavLinks = [
  { href: "/sanctuary", label: "SANCTUARY" },
  { href: "/settings", label: "SETTINGS" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Show all nav links when authenticated, only public links when not
  const visibleNavLinks = user
    ? [...publicNavLinks, ...protectedNavLinks]
    : publicNavLinks;

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
            <button className="pill bg-white border border-border-subtle text-accent-ink hover:bg-shell text-xs font-semibold tracking-wide flex items-center gap-2">
              🇺🇸 EN
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
