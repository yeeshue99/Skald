import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { CreateCampaignForm } from "@/components/forms/CreateCampaignForm";
import { ImportCampaignForm } from "@/components/forms/ImportCampaignForm";

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register?next=/new-campaign");

  return (
    <AuthShell
      title="Start a campaign"
      subtitle="You'll be its DM. You can rename and restyle everything later."
      wide
    >
      <CreateCampaignForm />

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-border" />
        or restore a backup
        <span className="h-px flex-1 bg-border" />
      </div>

      <ImportCampaignForm />
    </AuthShell>
  );
}
