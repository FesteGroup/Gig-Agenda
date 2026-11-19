import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDay, hhmm, hkToday, hkd, shiftHours } from "@/lib/time";
import { clashingGig, type MyInvitation } from "@/lib/my-gigs";

export function InvitationCard({ inv, all = [] }: { inv: MyInvitation; all?: MyInvitation[] }) {
  const qc = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const e = inv.events!;
  const r = inv.staffing_rows!;
  const hours = shiftHours(r.start_time, r.end_time, r.break_minutes);
  // Past events can't be changed any more.
  const past = e.day < hkToday();
  const expired = past || (inv.deadline && new Date(inv.deadline) < new Date());
  // Already booked at this time on another gig: can't accept this one.
  const clash = inv.status === "invited" ? clashingGig(inv, all) : null;

  async function respond(accept: boolean) {
    if (accept) {
      // Check again with fresh data: another gig at the same time may have been accepted meanwhile.
      const { data: fresh } = await supabase
        .from("invitations")
        .select(
          "*, events(id,title,client_name,day,start_time,venue,account), staffing_rows(position_id,start_time,end_time,break_minutes, positions(name,color))",
        )
        .eq("user_id", inv.user_id)
        .in("status", ["accepted", "confirmed"]);
      const busy = clashingGig(inv, [...all, ...((fresh ?? []) as unknown as MyInvitation[])]);
      if (busy) {
        toast.error(`You're already booked at this time: ${busy.events?.title ?? "another gig"}`);
        qc.invalidateQueries({ queryKey: ["my-invitations"] });
        return;
      }
    }
    const { error } = await supabase.rpc("respond_invitation", {
      _id: inv.id,
      _accept: accept,
      ...(!accept && reason ? { _reason: reason } : {}),
    });
    if (error) toast.error(error.message);
    else
      toast.success(
        accept
          ? "Accepted — the office will confirm"
          : inv.status === "invited"
            ? "Declined"
            : "Cancelled",
      );
    if (accept && !error) {
      // The worker is now busy at this time: other open invitations that overlap are declined (the office is told).
      const others = all.filter(
        (o) =>
          o.status === "invited" &&
          o.id !== inv.id &&
          clashingGig(o, [{ ...inv, status: "accepted" }]),
      );
      for (const o of others) {
        await supabase.rpc("respond_invitation", {
          _id: o.id,
          _accept: false,
          _reason: `Booked at that time on ${e.title}`,
        });
      }
      if (others.length)
        toast.info(
          `${others.length} other invitation${others.length === 1 ? "" : "s"} at the same time declined`,
        );
    }
    setDeclining(false);
    qc.invalidateQueries({ queryKey: ["my-invitations"] });
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: r.positions?.color }}
          >
            {r.positions?.name}
          </div>
          <div className="font-display text-lg font-bold leading-tight">{e.title}</div>
          <div className="text-sm text-muted-foreground">{e.client_name}</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">{fmtDay(e.day)}</div>
          {inv.rate != null && <div className="text-muted-foreground">{hkd(inv.rate * hours)}</div>}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" /> {hhmm(r.start_time)}–
          {hhmm(r.end_time)} · {hours.toFixed(1)} h
          {r.break_minutes ? ` (${r.break_minutes} min break)` : ""}
        </div>
        {e.venue && (
          <a
            className="flex items-center gap-2 underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
            href={`https://maps.google.com/?q=${encodeURIComponent(e.venue)}`}
          >
            <MapPin className="h-4 w-4 text-muted-foreground" /> {e.venue}
          </a>
        )}
        {inv.deadline && inv.status === "invited" && (
          <div className={expired ? "text-destructive" : "text-muted-foreground"}>
            Reply by{" "}
            {new Date(inv.deadline).toLocaleString("en-GB", {
              timeZone: "Asia/Hong_Kong",
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
      {inv.status === "invited" &&
        !expired &&
        (declining ? (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={() => respond(false)}>
                Decline
              </Button>
              <Button variant="ghost" onClick={() => setDeclining(false)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {clash && (
              <p className="rounded-md bg-warning/20 px-2 py-1.5 text-xs">
                You're already booked at this time: <b>{clash.events?.title}</b>{" "}
                {hhmm(clash.staffing_rows!.start_time)}–{hhmm(clash.staffing_rows!.end_time)}
                {clash.events!.day !== e.day ? ` (${fmtDay(clash.events!.day)})` : ""}.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setDeclining(true)}>
                Decline
              </Button>
              <Button onClick={() => respond(true)} disabled={!!clash}>
                {clash ? "Unavailable" : "Accept"}
              </Button>
            </div>
          </div>
        ))}
      {(inv.status === "accepted" || inv.status === "confirmed") && (
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
            {inv.status === "confirmed" ? "Confirmed" : "Accepted — awaiting confirmation"}
          </span>
          {past ? null : declining ? (
            <div className="flex gap-1">
              <Button size="sm" variant="destructive" onClick={() => respond(false)}>
                Yes, cancel
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
                No
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setDeclining(true)}>
              I can't make it
            </Button>
          )}
        </div>
      )}
      {["declined", "cancelled", "closed"].includes(inv.status) && (
        <div className="mt-3 text-xs text-muted-foreground">
          {inv.status === "closed"
            ? "Slots filled"
            : inv.status === "declined"
              ? "You declined"
              : "Cancelled"}
        </div>
      )}
    </div>
  );
}
