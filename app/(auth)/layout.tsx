import { Footer } from "@/components/layout/Footer";
import { SolaraLogo } from "@/components/layout/SolaraLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Simple header with logo */}
      <header className="py-8 px-6">
        <div className="max-w-md mx-auto">
          <SolaraLogo />
        </div>
      </header>

      {/* Auth content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        {/* Use max-w-4xl to accommodate Stripe Pricing Table on /join */}
        {/* Individual pages use their own width constraints (e.g., Card) */}
        <div className="w-full max-w-4xl">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
