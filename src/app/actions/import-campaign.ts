"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { campaignImportSchema, importCampaign } from "@/lib/campaign-import";
import { type FormState } from "@/lib/form";

const MAX_IMPORT_BYTES = 6 * 1024 * 1024; // matches serverActions.bodySizeLimit

// Create a fresh campaign from an uploaded Skald export (the JSON the Backup
// button produces). The signed-in user becomes the new campaign's DM.
export async function importCampaignAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/new-campaign");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a JSON export file." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: "That file is too large (max 6MB)." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { error: "That file isn't valid JSON." };
  }

  const parsed = campaignImportSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "That doesn't look like a Skald campaign export." };
  }

  let slug: string;
  try {
    slug = await importCampaign(user.id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }

  redirect(`/c/${slug}`);
}
