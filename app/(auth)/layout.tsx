import { Footer } from "@/components/layout/Footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Simple header with logo */}
      <header className="py-8 px-6">
        <div className="max-w-md mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-accent-gold-light to-accent-gold mb-2">
            <span className="text-2xl">☀️</span>
          </div>
          <h1 className="text-2xl font-bold">SOLARA</h1>
          <p className="micro-label text-accent-gold/80">CALM GUIDANCE FROM THE LIGHT</p>
        </div>
      </header>

      {/* Auth content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
