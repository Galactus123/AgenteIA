"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useMounted } from "@/lib/use-mounted";

const SCRIPT_ERROR_RE =
  /Encountered a script tag while rendering React component/i;

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  const mounted = useMounted();

  React.useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === "string" && SCRIPT_ERROR_RE.test(args[0])) return;
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  if (!mounted) return <>{children}</>;
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
