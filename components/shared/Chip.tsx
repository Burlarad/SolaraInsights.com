import { cn } from "@/lib/utils";

interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ children, active = false, onClick, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center pill text-sm font-medium transition-colors",
        active
          ? "bg-accent-ink text-white"
          : "bg-white text-accent-ink border border-border-subtle hover:bg-shell",
        onClick && "cursor-pointer",
        !onClick && "cursor-default",
        className
      )}
    >
      {children}
    </button>
  );
}
