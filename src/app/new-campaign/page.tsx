import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { CreateCampaignForm } from "@/components/forms/CreateCampaignForm";

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
    </AuthShell>
  );
}
