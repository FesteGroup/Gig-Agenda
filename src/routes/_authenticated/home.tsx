import { createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/lib/me";
import { EventCalendar } from "@/components/app/EventCalendar";
import { StaffHome } from "@/components/app/StaffHome";
import { InviteReplies } from "@/components/app/InviteReplies";
import { hkToday } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — Gig Agenda" }, { name: "description", content: "Events and gigs." }, { property: "og:title", content: "Home — Gig Agenda" }, { property: "og:description", content: "Events and gigs." }] }),
  component: Home,
});

function Home() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <p className="text-muted-foreground">Loading…</p>;
  if (!me.isOffice) return <StaffHome me={me} />;
  return (
    <div className="space-y-8">
      <EventCalendar />
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Replies</h2>
        <InviteReplies today={hkToday()} />
      </section>
    </div>
  );
}
