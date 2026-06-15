import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full flex-col justify-center px-4 py-10 ${wide ? "max-w-2xl" : "max-w-md"}`}
    >
      <Link href="/" className="mb-6 inline-block">
        <Wordmark name="Skald" className="text-3xl text-primary" />
      </Link>
      <h1 className="font-display text-2xl font-bold text-text">{title}</h1>
      {subtitle ? (
        <p className="mb-6 mt-1 text-muted">{subtitle}</p>
      ) : (
        <div className="mb-6" />
      )}
      {children}
      {footer ? <div className="mt-6 text-sm text-muted">{footer}</div> : null}
    </main>
  );
}
