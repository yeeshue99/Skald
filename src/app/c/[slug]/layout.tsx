import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { requireCampaignContext } from "@/lib/campaign";
import { themeToCssVars, themeDataAttrs, normalizeTheme } from "@/lib/themes";
import { cn } from "@/lib/cn";
import type { PersonaSummary } from "@/lib/queries";
import { getUnreadNotificationCount } from "@/lib/queries";
import { Toaster } from "@/components/Toaster";

// Particle effects render as their own animated layer inside .campaign-motion;
// card effects (pagecurl) are wrapper classes the CSS keys off.
const PARTICLE_EFFECTS = [
  "embers",
  "motes",
  "dust",
  "scanlines",
  "fog",
  "petalfall",
  "pollen",
  "leaves",
] as const;
const CARD_EFFECTS = ["pagecurl"] as const;

// `leaves` is the one particle effect with real per-leaf motion (an S-curve
// descent + an independent rocking spin), so unlike the tiled-background
// effects it renders N discrete leaf elements. The per-leaf variation lives in
// this fixed table (deterministic -> no SSR/CSR hydration drift); the CSS reads
// the custom properties and the shape/colour classes. Colours are natural leaf
// tones drawn from the reference GIFs (olive, green, gold, rust) plus a couple
// tied to the theme accent so it adapts a little per campaign.
const LEAF_FALL: {
  lx: string; // start X (% of viewport width)
  ld: string; // animation delay (negative => pre-filled on first paint)
  lt: string; // fall duration
  lsway: string; // peak horizontal drift
  lrot: string; // peak rock angle
  lscale: string; // size multiplier
  lc: string; // leaf colour
  shape: "a" | "b";
}[] = [
  { lx: "6%", ld: "-2s", lt: "15s", lsway: "26px", lrot: "34deg", lscale: "0.9", lc: "#9aae2a", shape: "a" },
  { lx: "14%", ld: "-9s", lt: "18s", lsway: "32px", lrot: "28deg", lscale: "1.1", lc: "#c2702f", shape: "b" },
  { lx: "23%", ld: "-5s", lt: "13s", lsway: "22px", lrot: "40deg", lscale: "0.75", lc: "#caa83a", shape: "a" },
  { lx: "31%", ld: "-12s", lt: "20s", lsway: "36px", lrot: "24deg", lscale: "1.0", lc: "var(--accent)", shape: "b" },
  { lx: "39%", ld: "-1s", lt: "16s", lsway: "28px", lrot: "32deg", lscale: "0.85", lc: "#7d9b3a", shape: "a" },
  { lx: "47%", ld: "-7s", lt: "14s", lsway: "24px", lrot: "38deg", lscale: "1.05", lc: "#c2702f", shape: "b" },
  { lx: "55%", ld: "-15s", lt: "19s", lsway: "34px", lrot: "26deg", lscale: "0.7", lc: "#9aae2a", shape: "a" },
  { lx: "63%", ld: "-3s", lt: "17s", lsway: "30px", lrot: "30deg", lscale: "0.95", lc: "#caa83a", shape: "b" },
  { lx: "70%", ld: "-10s", lt: "13s", lsway: "22px", lrot: "42deg", lscale: "1.15", lc: "var(--accent)", shape: "a" },
  { lx: "78%", ld: "-6s", lt: "21s", lsway: "38px", lrot: "22deg", lscale: "0.8", lc: "#7d9b3a", shape: "b" },
  { lx: "85%", ld: "-13s", lt: "15s", lsway: "26px", lrot: "36deg", lscale: "0.9", lc: "#c2702f", shape: "a" },
  { lx: "92%", ld: "-4s", lt: "18s", lsway: "32px", lrot: "28deg", lscale: "1.0", lc: "#9aae2a", shape: "b" },
  { lx: "50%", ld: "-18s", lt: "22s", lsway: "40px", lrot: "20deg", lscale: "0.65", lc: "#caa83a", shape: "a" },
  { lx: "18%", ld: "-16s", lt: "16s", lsway: "28px", lrot: "34deg", lscale: "1.2", lc: "var(--accent)", shape: "b" },
];
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

  const enabled = new Set(normalizeTheme(ctx.campaign.theme).decorations!.effects);
  const particleEffects = PARTICLE_EFFECTS.filter((e) => enabled.has(e));
  const cardEffectClasses = CARD_EFFECTS.filter((e) => enabled.has(e)).map(
    (e) => `fx-${e}`,
  );

  const personas: PersonaSummary[] = ctx.myPersonas.map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isNpc: p.isNpc,
  }));

  const unread = await getUnreadNotificationCount(
    ctx.campaign.id,
    ctx.myPersonas.map((p) => p.id),
  );

  return (
    <div
      {...themeDataAttrs(ctx.campaign.theme)}
      style={themeToCssVars(ctx.campaign.theme)}
      className={cn("min-h-dvh bg-bg font-body text-text", cardEffectClasses)}
    >
      {/* texture backdrop is drawn by [data-campaign]::before in globals.css */}
      {/* ambient effect layers — one per selected particle effect, all gated by
          prefers-reduced-motion in globals.css */}
      <div className="campaign-motion" aria-hidden>
        {particleEffects.map((e) =>
          e === "leaves" ? (
            <div key={e} className="fx fx-leaves">
              {LEAF_FALL.map((l, i) => (
                <span
                  key={i}
                  className={`leaf leaf--${l.shape}`}
                  style={
                    {
                      "--lx": l.lx,
                      "--ld": l.ld,
                      "--lt": l.lt,
                      "--lsway": l.lsway,
                      "--lrot": l.lrot,
                      "--lscale": l.lscale,
                      "--lc": l.lc,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          ) : (
            <div key={e} className={`fx fx-${e}`} />
          ),
        )}
      </div>
      <MobileNav
        slug={slug}
        appName={ctx.campaign.name}
        myHandle={ctx.actingPersona.handle}
        personas={personas}
        actingPersonaId={ctx.actingPersona.id}
        unreadNotifications={unread}
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
          unreadNotifications={unread}
        />
        <main className="min-h-dvh w-full max-w-[640px] flex-1 border-x border-border pb-24 md:pb-0">
          {children}
        </main>
        <RightRail ctx={ctx} />
      </div>
      <Toaster />
    </div>
  );
}
