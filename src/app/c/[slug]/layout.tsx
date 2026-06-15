import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireCampaignContext } from "@/lib/campaign";
import { themeToCssVars } from "@/lib/themes";
import type { PersonaSummary } from "@/lib/queries";
import { SideNav } from "@/components/SideNav";
import { RightRail } from "@/components/RightRail";
import { MobileNav } from "@/components/MobileNav";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);
  return {
    title: `${ctx.campaign.name} — ${ctx.campaign.theme.tagline}`,
  };
}

export default async function CampaignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireCampaignContext(slug);

  const personas: PersonaSummary[] = ctx.myPersonas.map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isNpc: p.isNpc,
  }));

  return (
    <div
      style={themeToCssVars(ctx.campaign.theme)}
      className="min-h-dvh bg-bg font-body text-text"
    >
      <MobileNav
        slug={slug}
        appName={ctx.campaign.name}
        myHandle={ctx.actingPersona.handle}
        personas={personas}
        actingPersonaId={ctx.actingPersona.id}
      />
      <div className="mx-auto flex w-full max-w-7xl">
        <SideNav
          slug={slug}
          appName={ctx.campaign.name}
          tagline={ctx.campaign.theme.tagline}
          isDm={ctx.role === "dm"}
          myHandle={ctx.actingPersona.handle}
          personas={personas}
          actingPersonaId={ctx.actingPersona.id}
        />
        <main className="min-h-dvh w-full max-w-[640px] flex-1 border-x border-border pb-24 md:pb-0">
          {children}
        </main>
        <RightRail ctx={ctx} />
      </div>
    </div>
  );
}
