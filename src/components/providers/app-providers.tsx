"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { MuiAppProvider } from "@/components/providers/mui-app-provider";
import { PortalSnackbarProvider } from "@/components/ui/portal-snackbar";

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
        <PortalSnackbarProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </PortalSnackbarProvider>
      </MuiAppProvider>
    </ThemeProvider>
  );
}
