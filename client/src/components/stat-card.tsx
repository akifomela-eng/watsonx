import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: "primary" | "accent" | "destructive" | "default";
}

export function StatCard({ title, value, icon: Icon, trend, color = "default" }: StatCardProps) {
  const colorMap = {
    primary: "text-primary border-primary",
    accent: "text-accent border-accent",
    destructive: "text-destructive border-destructive",
    default: "text-gray-400 border-gray-700",
  };

  return (
    <div className="bg-card p-6 border border-border hover:border-gray-500 transition-colors group">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-light mt-2 font-mono text-white">{value}</h3>
        </div>
        <div className={cn("p-2 bg-secondary/30", color === "default" ? "text-gray-400" : "")}>
          <Icon className={cn("h-6 w-6", 
            color === "primary" && "text-primary",
            color === "accent" && "text-accent",
            color === "destructive" && "text-destructive"
          )} />
        </div>
      </div>
      {trend && (
        <div className="text-xs text-muted-foreground pt-4 border-t border-border flex items-center">
          {trend}
        </div>
      )}
    </div>
  );
}
