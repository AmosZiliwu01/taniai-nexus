import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)}>
      <img
        src="https://zgiomlixpneyvujipplh.supabase.co/storage/v1/object/public/assets/WhatsApp%20Image%202026-05-31%20at%2005.32.00.jpeg"
        alt="TaniAI Nexus Logo"
        className="h-9 w-9 rounded-full object-cover"
      />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight text-foreground">TaniAI</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Nexus</span>
        </div>
      )}
    </Link>
  );
}