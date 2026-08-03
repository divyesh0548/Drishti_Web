"use client";

import { CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useMemo, useState, type ReactNode } from "react";

function buildTheme(mode: "light" | "dark") {
  const isDark = mode === "dark";

  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: isDark ? "#3b82f6" : "#2563eb",
        dark: isDark ? "#60a5fa" : "#1d4ed8",
        light: isDark ? "#93c5fd" : "#60a5fa",
        contrastText: "#eff6ff",
      },
      secondary: {
        main: isDark ? "#818cf8" : "#6366f1",
        dark: isDark ? "#a5b4fc" : "#4f46e5",
        contrastText: "#eff6ff",
      },
      background: {
        default: isDark ? "#08111f" : "#f8fafc",
        paper: isDark ? "#0f172a" : "#ffffff",
      },
      text: {
        primary: isDark ? "#eff6ff" : "#0f172a",
        secondary: isDark ? "#94a3b8" : "#64748b",
      },
      divider: isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(148, 163, 184, 0.28)",
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: "var(--font-sans), sans-serif",
      button: {
        textTransform: "none",
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: "1rem",
            paddingInline: "1rem",
            paddingBlock: "0.55rem",
            fontSize: "0.875rem",
            lineHeight: 1.4,
          },
          outlined: {
            borderColor: isDark ? "rgba(148, 163, 184, 0.28)" : "rgba(148, 163, 184, 0.32)",
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.72)",
            color: isDark ? "#e2e8f0" : "#1e293b",
            "&:hover": {
              borderColor: isDark ? "rgba(96, 165, 250, 0.4)" : "rgba(37, 99, 235, 0.28)",
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.94)",
            },
          },
        },
        variants: [
          {
            props: { variant: "contained", color: "primary" },
            style: {
              color: "#ffffff",
              WebkitTextFillColor: "#ffffff",
              background: isDark
                ? "linear-gradient(135deg, #3b82f6 0%, #818cf8 100%)"
                : "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
              boxShadow: "none",
              "&:hover": {
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                background: isDark
                  ? "linear-gradient(135deg, #60a5fa 0%, #a5b4fc 100%)"
                  : "linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)",
                boxShadow: "none",
              },
              "&.Mui-disabled": {
                color: "rgba(255,255,255,0.72)",
                WebkitTextFillColor: "rgba(255,255,255,0.72)",
              },
              "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                color: "#ffffff",
              },
            },
          },
        ],
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: "1rem",
          },
        },
      },
      MuiSelect: {
        defaultProps: {
          size: "small",
        },
        styleOverrides: {
          root: {
            borderRadius: "1rem",
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.92)",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: "1rem",
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.92)",
          },
          notchedOutline: {
            borderColor: isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(148, 163, 184, 0.28)",
          },
        },
      },
      MuiFormControl: {
        defaultProps: {
          size: "small",
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            minHeight: 40,
            borderRadius: 9999,
          },
        },
      },
    },
  });
}

export function MuiAppProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mode: "light" | "dark" = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
