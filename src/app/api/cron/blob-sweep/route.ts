import { sweepOrphanedBlobs } from "@/lib/blob-cleanup";

// Vercel Cron calls this on a schedule (see vercel.json) to delete orphaned blob
// images. Guarded by CRON_SECRET, which Vercel sends as a Bearer token; the route
// is disabled (503) until the secret is set, so it's never an open trigger for an
// expensive list/delete.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not configured", { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await sweepOrphanedBlobs();
  return Response.json(result);
}
