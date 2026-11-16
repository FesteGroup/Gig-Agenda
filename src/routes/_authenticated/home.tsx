import { createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/lib/me";
import { EventCalendar } from "@/components/app/EventCalendar";
import { StaffHome } from "@/components/app/StaffHome";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — Gig Agenda" }, { name: "description", content: "Events and gigs." }, { property: "og:title", content: "Home — Gig Agenda" }, { property: "og:description", content: "Events and gigs." }] }),
  component: Home,
});

function Home() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <p className="text-muted-foreground">Loading…</p>;
  return me.isOffice ? <EventCalendar /> : <StaffHome me={me} />;
}
