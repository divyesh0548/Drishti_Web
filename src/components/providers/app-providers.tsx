"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

import { MuiAppProvider } from "@/components/providers/mui-app-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <MuiAppProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                border: "1px solid var(--border)",
                background: "var(--surface-strong)",
                color: "var(--foreground)",
                boxShadow: "var(--shadow-md)",
              },
            }}
          />
        </QueryClientProvider>
      </MuiAppProvider>
    </ThemeProvider>
  );
}
