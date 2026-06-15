import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "@/components/forms/RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const normalizedCode = code?.trim().toUpperCase() || undefined;
  const user = await getCurrentUser();

  // look up the campaign tied to the code (if any) for a friendly heading
  let campaignName: string | undefined;
  if (normalizedCode) {
    const c = (
      await db
        .select({ name: campaigns.name, slug: campaigns.slug })
        .from(campaigns)
        .where(eq(campaigns.inviteCode, normalizedCode))
        .limit(1)
    )[0];
    campaignName = c?.name;

    // already signed in -> join with the existing account instead
    if (user) {
      if (c) redirect(`/join/${c.slug}?code=${normalizedCode}`);
      redirect("/");
    }
  } else if (user) {
    redirect("/");
  }

  return (
    <AuthShell
      title={campaignName ? `Join ${campaignName}` : "Create your account"}
      subtitle={
        normalizedCode
          ? "Set up a login and your character to join the feed."
          : "Make a login, then create or join a campaign."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm code={normalizedCode} campaignName={campaignName} />
    </AuthShell>
  );
}
