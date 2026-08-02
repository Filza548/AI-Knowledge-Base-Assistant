"use client";

import { cn } from "@/lib/utils";

type LogoMarkProps = {
  size?: number;
  className?: string;
  animated?: boolean;
};

/** Book + neural spark mark for AI Knowledge Base */
export function LogoMark({ size = 40, className, animated = false }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animated && "animate-float", className)}
      aria-hidden
    >
      <rect width="48" height="48" rx="14" fill="currentColor" className="text-primary" />
      <path
        d="M12 14.5C12 13.12 13.12 12 14.5 12H24v24H14.5C13.12 36 12 34.88 12 33.5V14.5Z"
        fill="white"
        fillOpacity="0.92"
      />
      <path
        d="M24 12h9.5C34.88 12 36 13.12 36 14.5v19c0 1.38-1.12 2.5-2.5 2.5H24V12Z"
        fill="white"
        fillOpacity="0.72"
      />
      <path d="M24 12v24" stroke="#050709" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="33.5" cy="16.5" r="3.2" fill="#d4af37" />
      <circle cx="38.2" cy="21.8" r="1.7" fill="#00e5ff" />
      <path
        d="M33.5 16.5L38.2 21.8"
        stroke="#d4af37"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="30.2" cy="22.5" r="1.4" fill="white" fillOpacity="0.9" />
      <path
        d="M33.5 16.5L30.2 22.5"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLockup({
  size = 40,
  subtitle,
  inverted = false,
  animated = false,
}: {
  size?: number;
  subtitle?: string;
  inverted?: boolean;
  animated?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} animated={animated} />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-semibold tracking-tight",
            inverted ? "text-sidebar-fg" : "text-foreground",
          )}
        >
          <span className="text-primary">AI</span> Knowledge Base
        </p>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-xs",
              inverted ? "text-sidebar-fg/60" : "text-text-secondary",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
