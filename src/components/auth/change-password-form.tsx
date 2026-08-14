"use client";

import { useState, useTransition } from "react";

import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { PortalButton } from "@/components/ui/portal-button";
import { usePortalSnackbar } from "@/components/ui/portal-snackbar";

export function ChangePasswordForm({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const { showError } = usePortalSnackbar();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = () => {
    startTransition(async () => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          currentPassword,
          password,
          confirmPassword,
        }),
      });

      const payload = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        showError(payload.error ?? "Unable to update password.");
        return;
      }

      window.location.assign(payload.redirectTo ?? "/dashboard");
    });
  };

  const logout = () => {
    startTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      window.location.assign("/login");
    });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-10 dark:bg-[linear-gradient(180deg,#08111f_0%,#0f172a_100%)]">
      <div className="enterprise-shell-card relative w-full max-w-xl overflow-hidden p-8 lg:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-[1.2rem] bg-gradient-to-br from-blue-100 via-sky-100 to-indigo-100 text-slate-950 shadow-lg shadow-blue-500/10 dark:from-blue-500/16 dark:via-sky-500/14 dark:to-indigo-500/14 dark:text-slate-50">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Password change required</p>
            <h1 className="mt-2 font-[var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50">
              Set a new password
            </h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Signed in as <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>. Replace the temporary password before accessing the workspace.
        </p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Temporary password</span>
            <input
              className="field-input"
              type="password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
              }}
              placeholder="Password from your email"
              autoComplete="current-password"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">New password</span>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm new password</span>
            <input
              className="field-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
              }}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isPending) {
                  submit();
                }
              }}
            />
          </label>

          <PortalButton
            variant="primary"
            fullWidth
            disabled={isPending || !currentPassword || !password || !confirmPassword}
            onClick={submit}
            endIcon={<ArrowRight className="h-4 w-4" />}
            sx={{ borderRadius: "1rem", px: 2.5, py: 1.75, fontSize: "0.875rem", fontWeight: 600, textTransform: "none" }}
          >
            {isPending ? "Updating password..." : "Save password and continue"}
          </PortalButton>

          <PortalButton
            variant="text"
            fullWidth
            disabled={isPending}
            onClick={logout}
            startIcon={<KeyRound className="h-4 w-4" />}
            sx={{ minWidth: 0, fontSize: "0.875rem", fontWeight: 500, textTransform: "none" }}
          >
            Sign out
          </PortalButton>
        </div>
      </div>
    </div>
  );
}
