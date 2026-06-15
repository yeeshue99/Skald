export type FormState = { error?: string; ok?: boolean };

export const emptyFormState: FormState = {};

/** Postgres unique-violation code, used to turn races into friendly messages. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/** Only allow same-origin relative redirects from ?next= params. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}
