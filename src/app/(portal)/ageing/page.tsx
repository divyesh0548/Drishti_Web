import { AgeingManager } from "@/components/portal/ageing-manager";
import { SectionCard, StatusPill } from "@/components/portal/cards";
import { getAgeingWorkspace } from "@/lib/ageing";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";

export default async function AgeingPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/ageing");
  const workspace = getAgeingWorkspace({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });

  return (
    <div className="space-y-6">
      <SectionCard
        title="Trade Receivables and Payables Ageing"
        eyebrow={`${context.company.name} | ${context.currentVersion.label} | Normal and MSME ageing`}
        action={<StatusPill label={context.permissions.canManageGrouping ? "Upload enabled" : "View only"} tone="positive" />}
      >
        <AgeingManager
          companyId={context.company.id}
          versionId={context.currentVersion.id}
          canEdit={context.permissions.canManageGrouping}
          store={workspace.store}
          receivables={workspace.receivables}
          payables={workspace.payables}
        />
      </SectionCard>
    </div>
  );
}
