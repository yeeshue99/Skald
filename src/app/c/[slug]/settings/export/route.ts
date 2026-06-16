import { getCampaignContext } from "@/lib/campaign";
import { exportCampaign } from "@/lib/campaign-export";

// GET /c/<slug>/settings/export -> a downloadable JSON backup of the campaign.
// DM-only: a member who isn't the DM gets 403, a non-member 404.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const ctx = await getCampaignContext(slug);
  if (!ctx) return new Response("Not found", { status: 404 });
  if (ctx.role !== "dm") return new Response("Forbidden", { status: 403 });

  const data = await exportCampaign(ctx.campaign.id);
  const body = JSON.stringify(data, null, 2);
  const filename = `${slug}-skald-export.json`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
