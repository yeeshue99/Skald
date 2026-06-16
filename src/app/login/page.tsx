import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/form";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/forms/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your campaigns."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
      <p className="mt-4 text-center text-xs text-muted">
        Forgot your password? Ask your campaign&apos;s DM to reset it for you.
      </p>
    </AuthShell>
  );
}
