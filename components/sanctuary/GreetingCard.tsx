import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GreetingCardProps {
  name?: string;
  message?: string;
  className?: string;
}

export function GreetingCard({
  name = "Friend",
  message = "Your daily insights are being prepared by the cosmos.",
  className,
}: GreetingCardProps) {
  return (
    <Card className={cn("border-border-subtle", className)}>
      <CardContent className="p-4 md:p-8">
        <h2 className="text-2xl md:text-3xl font-semibold mb-2">
          Quiet clarity, {name}.
        </h2>
        <p className="text-sm md:text-base text-accent-ink/70">{message}</p>
      </CardContent>
    </Card>
  );
}
