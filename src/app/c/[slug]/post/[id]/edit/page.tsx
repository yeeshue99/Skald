import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireCampaignContext } from "@/lib/campaign";
import { getPostForEdit } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { EditPostForm } from "@/components/EditPostForm";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const ctx = await requireCampaignContext(slug);
  const post = await getPostForEdit(ctx.campaign.id, postId);
  if (!post) notFound();

  const canEdit =
    ctx.role === "dm" || ctx.myPersonas.some((p) => p.id === post.personaId);
  if (!canEdit) notFound();

  return (
    <>
      <PageHeader
        title="Edit post"
        backHref={`/c/${slug}/post/${postId}`}
        desktopOnly={false}
      />
      <EditPostForm
        slug={slug}
        postId={postId}
        initialContent={post.content}
        initialImageUrl={post.imageUrl}
      />
    </>
  );
}
