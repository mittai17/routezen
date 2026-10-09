import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative overflow-hidden rounded-lg bg-muted", "after:absolute after:inset-0 after:-translate-x-full after:animate-[rz-shimmer_1.4s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/40 dark:after:via-white/5 after:to-transparent", className)} />
  );
}
