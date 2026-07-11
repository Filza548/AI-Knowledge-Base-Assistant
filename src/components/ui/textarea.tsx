import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
