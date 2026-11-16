import { createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/lib/me";
import { useMyInvitations } from "@/lib/my-gigs";
import { InvitationCard } from "@/components/app/InvitationCard";

export const Route = createFileRoute("/_authenticated/invitations")({
  head: () => ({ meta: [{ title: "Invitations — Gig Agenda" }, { name: "description", content: "Your gig invitations." }, { property: "og:title", content: "Invitations — Gig Agenda" }, { property: "og:description", content: "Your gig invitations." }] }),
  component: Page,
});

function Page() {
  const { data: me } = useMe();
  const { data = [] } = useMyInvitations(me?.id);
  const open = data.filter((i) => i.status === "invited");
  const past = data.filter((i) => i.status !== "invited");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Invitations</h1>
      {open.length === 0 && <p className="text-muted-foreground">No open invitations.</p>}
      <div className="space-y-3">{open.map((i) => <InvitationCard key={i.id} inv={i} />)}</div>
      {past.length > 0 && (
        <>
          <h2 className="pt-4 text-xl font-bold">Earlier</h2>
          <div className="space-y-3">{past.slice(0, 30).map((i) => <InvitationCard key={i.id} inv={i} />)}</div>
        </>
      )}
    </div>
  );
}
