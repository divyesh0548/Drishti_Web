import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { WorkspaceAdmin } from "@/components/portal/workspace-admin";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveOptionalWorkspaceContextFromSearchParams } from "@/lib/portal-context";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveOptionalWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/admin");

  if (context.currentUser.role === "SITE_ADMIN") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={`${context.company?.name ?? "Drishti"} | Site Administration`}
          title="Workspace governance and provisioning"
          description="Manage companies, role-aware access, signatories, and reporting controls without changing the underlying financial workflows."
          meta={<StatusPill label="Site admin mode" tone="positive" />}
        />
        <WorkspaceAdmin context={context} />
      </div>
    );
  }

  if (!context.company) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="No company assigned"
          description="This account is not linked to a company yet. Ask the site admin to provision access."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion?.label ?? "No version"}`}
        title="Administration and statement controls"
        description="Configure company users, signatories, Excel layout profile, and control assumptions for the company workspace."
        meta={<StatusPill label="Company admin mode" tone="positive" />}
      />

      <WorkspaceAdmin context={context} />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <SectionCard title="Classification controls" eyebrow="Source rules and assumptions" action={<StatusPill label="Workbook mode" tone="positive" />}>
          <div className="enterprise-table">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Control</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { role: "Company", scope: context.company.name, users: "Company-scoped data folder" },
                  {
                    role: "Active version",
                    scope: context.currentVersion?.label ?? "None yet — upload a trial balance",
                    users: "Versioned statements and downloads",
                  },
                  { role: "Balance rule", scope: "Sum of trial balance rows", users: "Flags non-zero residuals" },
                  { role: "GL prefix model", scope: "1/2/3/4 => BS/BS/P&L/P&L", users: "Primary statement routing" },
                  { role: "Keyword model", scope: "Ledger description inference", users: "Subgroup classification" },
                ].map((row) => (
                  <tr key={row.role} className="border-t border-slate-200/70 dark:border-white/10">
                    <td className="px-4 py-3 font-medium">{row.role}</td>
                    <td className="px-4 py-3">{row.scope}</td>
                    <td className="px-4 py-3">{row.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Current assumptions" eyebrow="What to validate next">
          <div className="space-y-4">
            {[
              "Each company has its own logic, versions, signatories, and statement format files in a separate workspace folder.",
              "Upload a trial balance in Imports to create the first version before mapping and statements are available.",
              "Assign an Excel layout profile in company settings when the company needs a custom structural report.",
              "Configured auditors and directors print below exported statement outputs for the selected company.",
            ].map((item) => (
              <div key={item} className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <p className="text-sm leading-6">{item}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
