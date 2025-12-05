import { cn } from "@/lib/utils";

interface PrimaryCTAProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export function PrimaryCTA({ children, onClick, href, className }: PrimaryCTAProps) {
  const baseClasses = cn(
    "inline-flex items-center justify-center pill gradient-gold text-white text-base font-semibold transition-opacity hover:opacity-90 px-12 py-4",
    className
  );

  if (href) {
    return (
      <a href={href} className={baseClasses}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseClasses}>
      {children}
    </button>
  );
}
