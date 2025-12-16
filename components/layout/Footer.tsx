import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full mt-12 md:mt-24">
      <div className="gradient-footer py-6 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-accent-ink/70">
            <Link href="/privacy" className="hover:text-accent-gold transition-colors">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-accent-gold transition-colors">
              Terms of Service
            </Link>
            <span>·</span>
            <Link href="/about" className="hover:text-accent-gold transition-colors">
              About
            </Link>
          </div>
          <p className="text-center text-sm text-accent-ink/70">
            © 2025 Solara Insights — Built with care under the light of the stars.
          </p>
        </div>
      </div>
    </footer>
  );
}
