import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GreetingCardProps {
  name?: string;
  message?: string;
  hasBirthTime?: boolean;
  className?: string;
}

export function GreetingCard({
  name = "Friend",
  message = "Your daily insights are being prepared by the cosmos.",
  hasBirthTime = false,
  className,
}: GreetingCardProps) {
  return (
    <Card className={cn("border-border-subtle", className)}>
      <CardContent className="p-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold mb-2">
            Quiet clarity, {name}.
          </h2>
          <p className="text-base text-accent-ink/70">{message}</p>
        </div>

        {hasBirthTime && (
          <div className="pill bg-accent-muted text-accent-ink text-xs font-medium flex-shrink-0">
            ✓ Exact birth time saved
          </div>
        )}
      </CardContent>
    </Card>
  );
}
