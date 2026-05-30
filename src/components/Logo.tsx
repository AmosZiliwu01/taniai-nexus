import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
        <Sprout className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight text-foreground">TaniAI</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Nexus</span>
        </div>
      )}
    </div>
  );
}
