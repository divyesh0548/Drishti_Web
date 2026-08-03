"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PortalButton } from "@/components/ui/portal-button";
import { PortalSelect } from "@/components/ui/portal-select";
import type { CompanySettings, WorkspaceContext } from "@/lib/company-workspace";

type UserRole = "COMPANY_ADMIN" | "FINANCE" | "AUDITOR";

export function WorkspaceAdmin({
  context,
}: {
  context: WorkspaceContext;
}) {
  const isSiteAdmin = context.currentUser.role === "SITE_ADMIN";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    code: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [userForm, setUserForm] = useState<{ name: string; email: string; password: string; role: UserRole }>({
    name: "",
    email: "",
    password: "",
    role: "FINANCE",
  });
  const [settingsForm, setSettingsForm] = useState<CompanySettings>(context.settings);

  const refresh = () => {
    router.refresh();
  };

  const createCompany = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/workspace/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: companyForm.name,
          code: companyForm.code,
          adminName: companyForm.adminName,
          adminEmail: companyForm.adminEmail,
          adminPassword: companyForm.adminPassword,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Unable to create company.");
        return;
      }

      setMessage("Company and company admin created.");
      setCompanyForm({ name: "", code: "", adminName: "", adminEmail: "", adminPassword: "" });
      refresh();
    });
  };

  const createUser = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/workspace/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: context.company.id,
          ...userForm,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Unable to create user.");
        return;
      }

      setMessage("Company user created.");
      setUserForm({ name: "", email: "", password: "", role: "FINANCE" });
      refresh();
    });
  };

  const saveSettings = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: context.company.id,
          ...settingsForm,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Unable to save company settings.");
        return;
      }

      setMessage("Company signatories and footer settings saved.");
      refresh();
    });
  };

  const updateSignatory = (
    section: "directors" | "auditors",
    index: number,
    field: "name" | "designation" | "firmName" | "membershipNumber",
    value: string,
  ) => {
    setSettingsForm((current) => ({
      ...current,
      [section]: current[section].map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              [field]: value,
            }
          : entry,
      ),
    }));
  };

  const addSignatory = (section: "directors" | "auditors") => {
    setSettingsForm((current) => ({
      ...current,
      [section]: [
        ...current[section],
        {
          name: "",
          designation: "",
          ...(section === "auditors" ? { firmName: "", membershipNumber: "" } : {}),
        },
      ],
    }));
  };

  const query = searchParams.toString();

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {context.permissions.canManageCompanies ? (
        <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <h3 className="text-lg font-semibold">Create company</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create the company and set the initial company admin login in one step.
          </p>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <input
              className="field-input"
              value={companyForm.name}
              onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Company name"
            />
            <input
              className="field-input"
              value={companyForm.code}
              onChange={(event) => setCompanyForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="Code"
            />
            <input
              className="field-input"
              value={companyForm.adminName}
              onChange={(event) => setCompanyForm((current) => ({ ...current, adminName: event.target.value }))}
              placeholder="Company admin name"
            />
            <input
              className="field-input"
              value={companyForm.adminEmail}
              onChange={(event) => setCompanyForm((current) => ({ ...current, adminEmail: event.target.value }))}
              placeholder="Company admin username / email"
            />
            <input
              className="field-input"
              type="password"
              value={companyForm.adminPassword}
              onChange={(event) => setCompanyForm((current) => ({ ...current, adminPassword: event.target.value }))}
              placeholder="Company admin password"
            />
          </div>
          <PortalButton
            variant="primary"
            type="button"
            disabled={
              isPending ||
              !companyForm.name ||
              !companyForm.code ||
              !companyForm.adminName ||
              !companyForm.adminEmail ||
              !companyForm.adminPassword
            }
            onClick={createCompany}
            className="mt-4"
          >
            Create company
          </PortalButton>
        </div>
      ) : null}

      {isSiteAdmin ? (
        <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <h3 className="text-lg font-semibold">Companies</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Site admin access is limited here to company provisioning. Company-level user and reporting settings are now managed by the company admin.
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
            Trial balance versions, ledger groupings, and statement customizations remain company specific. For demo flows, the site admin can still switch companies from the top bar and review each company workspace separately.
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {context.companies.map((company) => (
                  <tr key={company.id} className="border-t border-slate-200/70 dark:border-white/10">
                    <td className="px-4 py-3 font-medium">{company.name}</td>
                    <td className="px-4 py-3">{company.code}</td>
                    <td className="px-4 py-3">
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(company.updatedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!isSiteAdmin ? (
        <>
          <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Company users</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Company admins can create finance and auditor users and define their login passwords.
                </p>
              </div>
              {query ? <p className="text-xs uppercase tracking-[0.08em] text-slate-500">{context.company.name}</p> : null}
            </div>

            {context.permissions.canManageCompanyUsers ? (
              <div className="mt-4 grid gap-3 xl:grid-cols-4">
                <input
                  className="field-input"
                  value={userForm.name}
                  onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="User name"
                />
                <input
                  className="field-input"
                  value={userForm.email}
                  onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Username / email"
                />
                <input
                  className="field-input"
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Password"
                />
                <PortalSelect
                  value={userForm.role}
                  onChange={(value) => setUserForm((current) => ({ ...current, role: value as UserRole }))}
                  options={[
                    { value: "COMPANY_ADMIN", label: "Company Admin" },
                    { value: "FINANCE", label: "Finance" },
                    { value: "AUDITOR", label: "Auditor" },
                  ]}
                />
              </div>
            ) : null}
            <PortalButton
              variant="primary"
              type="button"
              disabled={isPending || !userForm.name || !userForm.email || !userForm.password}
              onClick={createUser}
            >
              Add user
            </PortalButton>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {context.companyUsers.map((user) => (
                    <tr key={user.id} className="border-t border-slate-200/70 dark:border-white/10">
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">{user.role}</td>
                      <td className="px-4 py-3">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(user.createdAt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
            <h3 className="text-lg font-semibold">Statement signatories and footer</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              These details print below statement outputs for the selected company.
            </p>

            <div className="mt-4 grid gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <p className="font-medium">Directors</p>
                {settingsForm.directors.map((director, index) => (
                  <div key={`director-${index}`} className="grid gap-3 md:grid-cols-2">
                    <input
                      className="field-input"
                      value={director.name}
                      onChange={(event) => updateSignatory("directors", index, "name", event.target.value)}
                      placeholder="Director name"
                    />
                    <input
                      className="field-input"
                      value={director.designation}
                      onChange={(event) => updateSignatory("directors", index, "designation", event.target.value)}
                      placeholder="Designation"
                    />
                  </div>
                ))}
                {context.permissions.canEditSignatories ? (
                  <PortalButton variant="secondary" type="button" onClick={() => addSignatory("directors")}>
                    Add director
                  </PortalButton>
                ) : null}
              </div>

              <div className="space-y-4">
                <p className="font-medium">Auditors</p>
                {settingsForm.auditors.map((auditor, index) => (
                  <div key={`auditor-${index}`} className="grid gap-3 md:grid-cols-2">
                    <input
                      className="field-input"
                      value={auditor.firmName ?? ""}
                      onChange={(event) => updateSignatory("auditors", index, "firmName", event.target.value)}
                      placeholder="Audit firm"
                    />
                    <input
                      className="field-input"
                      value={auditor.name}
                      onChange={(event) => updateSignatory("auditors", index, "name", event.target.value)}
                      placeholder="Partner / signer"
                    />
                    <input
                      className="field-input"
                      value={auditor.designation}
                      onChange={(event) => updateSignatory("auditors", index, "designation", event.target.value)}
                      placeholder="Designation"
                    />
                    <input
                      className="field-input"
                      value={auditor.membershipNumber ?? ""}
                      onChange={(event) => updateSignatory("auditors", index, "membershipNumber", event.target.value)}
                      placeholder="Membership number"
                    />
                  </div>
                ))}
                {context.permissions.canEditSignatories ? (
                  <PortalButton variant="secondary" type="button" onClick={() => addSignatory("auditors")}>
                    Add auditor
                  </PortalButton>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              <input
                className="field-input"
                value={settingsForm.reportingCurrency}
                onChange={(event) => setSettingsForm((current) => ({ ...current, reportingCurrency: event.target.value }))}
                placeholder="Currency"
              />
              <input
                className="field-input"
                value={settingsForm.unitsLabel}
                onChange={(event) => setSettingsForm((current) => ({ ...current, unitsLabel: event.target.value }))}
                placeholder="Units label"
              />
              <input
                className="field-input"
                value={settingsForm.footerNote}
                onChange={(event) => setSettingsForm((current) => ({ ...current, footerNote: event.target.value }))}
                placeholder="Footer note"
              />
            </div>

            {context.permissions.canEditSignatories ? (
              <PortalButton variant="primary" type="button" disabled={isPending} onClick={saveSettings} className="mt-4">
                Save company settings
              </PortalButton>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
