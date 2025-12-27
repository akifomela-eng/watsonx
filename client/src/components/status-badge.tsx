import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type?: "scan" | "decision";
}

export function StatusBadge({ status, type = "scan" }: StatusBadgeProps) {
  let styles = "bg-gray-800 text-gray-300 border-gray-700";
  
  const normalized = status.toLowerCase();

  if (type === "scan") {
    if (normalized === "completed") styles = "bg-green-900/20 text-green-400 border-green-900/50";
    else if (normalized === "processing") styles = "bg-blue-900/20 text-blue-400 border-blue-900/50 animate-pulse";
    else if (normalized === "failed") styles = "bg-red-900/20 text-red-400 border-red-900/50";
    else if (normalized === "pending") styles = "bg-yellow-900/20 text-yellow-400 border-yellow-900/50";
  } else {
    // Decision Priority
    if (normalized === "critical") styles = "bg-red-950 text-red-500 border-red-900 font-bold";
    else if (normalized === "high") styles = "bg-orange-900/20 text-orange-400 border-orange-900/50";
    else if (normalized === "medium") styles = "bg-yellow-900/20 text-yellow-400 border-yellow-900/50";
    else if (normalized === "low") styles = "bg-blue-900/20 text-blue-400 border-blue-900/50";
  }

  return (
    <span className={cn(
      "px-2.5 py-0.5 text-xs font-mono uppercase tracking-wide border",
      styles
    )}>
      {status}
    </span>
  );
}
