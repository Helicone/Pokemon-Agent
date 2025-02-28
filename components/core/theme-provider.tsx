"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";

export function ThemeProvider({
  children,
  ...props
}: React.PropsWithChildren<{
  [key: string]: unknown;
}>) {
  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      forcedTheme="dark"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
