import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  subLabel?: string;
  trend?: "up" | "down" | "neutral";
  variant?: "positive" | "negative" | "neutral";
}

export function StatCard({ title, value, icon: Icon, description, subLabel, variant = "neutral" }: StatCardProps) {
  const valueColor = variant === "positive"
    ? "text-emerald-600 dark:text-emerald-400"
    : variant === "negative"
    ? "text-red-600 dark:text-red-400"
    : "text-foreground";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={cn("text-2xl font-semibold mt-1", valueColor)}>{value}</p>
            {subLabel && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subLabel}</p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
