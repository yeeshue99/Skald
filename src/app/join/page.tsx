import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { JoinForm } from "@/components/forms/JoinForm";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  if (!(await getCurrentUser())) redirect("/login?next=/join");
  const { code } = await searchParams;

  return (
    <AuthShell
      title="Join a campaign"
      subtitle="Enter the invite code your DM shared and create your character."
    >
      <JoinForm defaultCode={code?.trim().toUpperCase()} />
    </AuthShell>
  );
}
