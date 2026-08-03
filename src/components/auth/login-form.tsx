"use client";

import { useState, useTransition } from "react";

import { ArrowRight, BarChart3, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { PortalButton } from "@/components/ui/portal-button";

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }

      window.location.assign(payload.redirectTo ?? "/dashboard");
    });
  };

  const submitPasswordReset = () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          password: newPassword,
          confirmPassword,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to reset password.");
        return;
      }

      setMessage(payload.message ?? "Password updated successfully.");
      setMode("login");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  };

  return (
    <div className="grid min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] lg:grid-cols-[1.08fr_0.92fr] dark:bg-[linear-gradient(180deg,#08111f_0%,#0f172a_100%)]">
      <section className="relative overflow-hidden bg-[linear-gradient(140deg,#071226_0%,#0d2242_45%,#123a6d_100%)] px-8 py-10 text-white lg:px-14 lg:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
        <div className="relative mx-auto flex h-full max-w-3xl flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-sky-200" />
              Enterprise reporting workspace
            </div>
            <h1 className="mt-7 max-w-2xl font-[var(--font-display)] text-4xl font-semibold tracking-[-0.05em] text-white lg:text-6xl">
              Premium financial reporting, designed for fast close and confident audit review.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              Drishti connects trial balance ingestion, intelligent mapping, validation workflows, and board-ready financial statements in one controlled portal.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: BarChart3, title: "Live analysis", detail: "KPI-driven statement progress and reporting signals." },
              { icon: Sparkles, title: "Mapping intelligence", detail: "Accelerate grouping, ratios, notes, and exception review." },
              { icon: LockKeyhole, title: "Governed access", detail: "Role-based workspace controls with version-aware outputs." },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 backdrop-blur">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12">
                  <item.icon className="h-5 w-5 text-sky-100" />
                </div>
                <p className="mt-4 text-lg font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-10 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_26%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_22%)]" />
        <div className="enterprise-shell-card relative w-full max-w-xl overflow-hidden p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-[1.2rem] bg-gradient-to-br from-blue-100 via-sky-100 to-indigo-100 text-slate-950 shadow-lg shadow-blue-500/10 dark:from-blue-500/16 dark:via-sky-500/14 dark:to-indigo-500/14 dark:text-slate-50">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Secure Sign In</p>
              <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50">
                Access your reporting workspace
              </h2>
            </div>
          </div>

          <div className="mt-8 grid gap-4 rounded-[1.5rem] border border-slate-200/70 bg-slate-50/75 p-4 dark:border-white/10 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Workspace Security</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use your role-based credentials to open the current company context.</p>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/20">
                Protected
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</span>
              <input
                className="field-input"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                placeholder="name@company.com"
                autoComplete="username"
              />
            </label>

            {mode === "login" ? (
              <label className="block">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Password</span>
                  <PortalButton
                    variant="text"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setMessage(null);
                    }}
                    sx={{ minWidth: 0, p: 0, fontSize: "0.875rem", fontWeight: 500, textTransform: "none" }}
                  >
                    Forgot Password
                  </PortalButton>
                </div>
                <input
                  className="field-input"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isPending) {
                      submit();
                    }
                  }}
                />
              </label>
            ) : (
              <div className="space-y-5 rounded-[1.5rem] border border-slate-200/70 bg-slate-50/75 p-4 dark:border-white/10 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Reset password</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Set a new password for your workspace account.</p>
                  </div>
                  <PortalButton
                    variant="text"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setMessage(null);
                    }}
                    sx={{ minWidth: 0, p: 0, fontSize: "0.875rem", fontWeight: 500, textTransform: "none", whiteSpace: "nowrap" }}
                  >
                    Back to sign in
                  </PortalButton>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">New password</span>
                  <input
                    className="field-input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError(null);
                    }}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm password</span>
                  <input
                    className="field-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError(null);
                    }}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !isPending) {
                        submitPasswordReset();
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Remember me
              </label>
              <span>Enterprise access for finance, audit, and admin roles</span>
            </div>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-300">{error}</div> : null}
            {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-300">{message}</div> : null}

            <PortalButton
              variant="primary"
              fullWidth
              disabled={isPending || !email || (mode === "login" ? !password : !newPassword || !confirmPassword)}
              onClick={mode === "login" ? submit : submitPasswordReset}
              endIcon={<ArrowRight className="h-4 w-4" />}
              sx={{ borderRadius: "1rem", px: 2.5, py: 1.75, fontSize: "0.875rem", fontWeight: 600, textTransform: "none" }}
            >
              {isPending ? (mode === "login" ? "Signing in..." : "Updating password...") : mode === "login" ? "Sign in to Drishti" : "Reset password"}
            </PortalButton>
          </div>
        </div>
      </section>
    </div>
  );
}
