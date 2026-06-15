import Link from "next/link";
import { CalendarClock, Drama, Palette, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMyCampaigns } from "@/lib/campaign";
import { logoutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/Wordmark";
import { buttonClasses, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    const campaigns = await getMyCampaigns(user.id);
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <Wordmark name="Skald" className="text-3xl text-primary" />
          <form action={logoutAction}>
            <button className="text-sm text-muted hover:text-text">Log out</button>
          </form>
        </div>

        <h1 className="font-display text-2xl font-bold text-text">
          Your campaigns
        </h1>
        <p className="mt-1 text-muted">
          Signed in as <span className="text-text">@{user.username}</span>.
        </p>

        {campaigns.length > 0 ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.slug}`}>
                  <Card className="overflow-hidden transition-transform hover:-translate-y-0.5">
                    <div
                      className="p-5"
                      style={{ background: c.theme.colors.background }}
                    >
                      <span
                        className="font-display text-2xl font-bold"
                        style={{
                          color: c.theme.colors.primary,
                          fontFamily: `"${c.theme.fonts.display}", serif`,
                        }}
                      >
                        {c.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <span className="truncate text-sm text-muted">
                        {c.theme.tagline}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                          c.role === "dm"
                            ? "bg-accent/15 text-accent"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {c.role === "dm" ? "DM" : "Player"}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-6 p-8 text-center text-muted">
            You&apos;re not in any campaigns yet. Create one as a DM, or join with
            an invite code.
          </Card>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/new-campaign" className={buttonClasses("primary")}>
            Create a campaign
          </Link>
          <Link href="/join" className={buttonClasses("secondary")}>
            Join with a code
          </Link>
        </div>
      </main>
    );
  }

  const features = [
    {
      icon: Drama,
      title: "Post as anyone",
      text: "Run NPCs and players from one feed. Switch personas per post.",
    },
    {
      icon: CalendarClock,
      title: "Schedule reveals",
      text: "Queue posts to go live at the exact moment in your session.",
    },
    {
      icon: Palette,
      title: "Theme per campaign",
      text: "STR/X for Strixhaven, Scrollr for fantasy, or roll your own.",
    },
    {
      icon: Users,
      title: "Private to your table",
      text: "Invite-only. Just your group, no strangers.",
    },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4">
      <header className="flex items-center justify-between py-6">
        <Wordmark name="Skald" className="text-2xl text-primary" />
        <Link href="/login" className={buttonClasses("secondary", "sm")}>
          Log in
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight text-text sm:text-6xl">
          A social feed for your tabletop campaign.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Tweet as NPCs and players. Follow each other. Schedule the big reveal.
          Reskin it for every world you run.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/new-campaign" className={buttonClasses("primary", "lg")}>
            Start a campaign
          </Link>
          <Link href="/login" className={buttonClasses("secondary", "lg")}>
            I have an invite code
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="p-5 text-left">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold text-text">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-muted">
        Skald · a private, themeable feed for your table.
      </footer>
    </main>
  );
}
