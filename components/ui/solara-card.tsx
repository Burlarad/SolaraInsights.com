import * as React from "react";
import { cn } from "@/lib/utils";

type SolaraCardProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Soft, airy surface used for Solara content blocks.
 * Keeps padding responsive and adds a gentle lift over the gradient background.
 */
export const SolaraCard = React.forwardRef<HTMLDivElement, SolaraCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-white/30 bg-white/60 shadow-sm backdrop-blur-sm p-5 sm:p-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SolaraCard.displayName = "SolaraCard";
