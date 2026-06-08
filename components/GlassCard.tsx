import { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlassCard({ children, className, glowColor }: GlassCardProps) {
  // If a glowColor is provided, set the custom CSS variable
  const style = glowColor 
    ? { "--card-glow": glowColor } as CSSProperties 
    : undefined;

  return (
    <div 
      className={cn(
        "glass-panel rounded-2xl p-6 transition-all duration-300",
        className
      )}
      style={style}
    >
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
