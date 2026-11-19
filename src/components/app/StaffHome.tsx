import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clashingGig, useMyInvitations, type MyInvitation } from "@/lib/my-gigs";
import { addDays, fmtDay, hhmm, hkToday, hkd, hkdExact, shiftHours } from "@/lib/time";
import { isPublicHoliday, shiftPay } from "@/lib/pay";
import { cn } from "@/lib/utils";
import { InvitationCard } from "./InvitationCard";
import { RateSuggest } from "./RateSuggest";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Me } from "@/lib/me";

export function StaffHome({ me }: { me: Me }) {
  const { data = [] } = useMyInvitations(me.id);
  const today = hkToday();
  const pending = data.filter(
    (i) =>
      i.status === "invited" &&
      (!i.deadline || new Date(i.deadline) > new Date()) &&
      !clashingGig(i, data),
  );
  const gigs = data
    .filter((i) => (i.status === "confirmed" || i.status === "accepted") && i.events!.day >= today)
    .sort((a, b) => a.events!.day.localeCompare(b.events!.day));
  const month = today.slice(0, 7);
  const monthGigs = data.filter((i) => i.status === "confirmed" && i.events!.day.startsWith(month));
  const hours = monthGigs.reduce(
    (s, i) =>
      s +
      shiftHours(
        i.staffing_rows!.start_time,
        i.staffing_rows!.end_time,
        i.staffing_rows!.break_minutes,
      ),
    0,
  );
  const earnings = monthGigs.reduce(
    (s, i) =>
      s +
      (i.rate ?? 0) *
        shiftHours(
          i.staffing_rows!.start_time,
          i.staffing_rows!.end_time,
          i.staffing_rows!.break_minutes,
        ),
    0,
  );
  // Forecast earnings: same rule as the office forecast (accepted and confirmed gigs from today, on each shift's hours and pay rules).
  const [span, setSpan] = useState<7 | 14 | 30>(7);
  const [rateOpen, setRateOpen] = useState(false);
  const { data: mainPos = null } = useQuery({
    queryKey: ["my-main-position", me.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("main_position_id").eq("id", me.id).maybeSingle()).data
        ?.main_position_id ?? null,
  });
  const until = addDays(today, span - 1);
  const ahead = data.filter(
    (i) =>
      (i.status === "accepted" || i.status === "confirmed") &&
      i.staffing_rows &&
      i.events!.day >= today &&
      i.events!.day <= until,
  );
  const forecast = ahead.reduce((s, i) => {
    const r = i.staffing_rows!;
    return (
      s +
      (shiftPay({
        position: r.positions?.name,
        start: r.start_time,
        end: r.end_time,
        breakMinutes: r.break_minutes,
        personalRate: i.rate,
        publicHoliday: isPublicHoliday(null, i.events!.day),
      }) ?? 0)
    );
  }, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Hi {me.fullName.split(" ")[0]}</p>
        <h1 className="text-3xl font-bold">My gigs</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Gigs this month" value={String(monthGigs.length)} />
        <Stat label="Hours" value={hours.toFixed(1)} />
        <Stat label="Earnings" value={hkd(earnings)} />
        <div
          role="button"
          tabIndex={0}
          onClick={() => setRateOpen(true)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setRateOpen(true)}
          title="My hourly rate"
          className="cursor-pointer rounded-xl border bg-card p-3 transition-colors hover:bg-secondary"
        >
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="mr-auto">Forecast</span>
            {(
              [
                [7, "W"],
                [14, "2W"],
                [30, "M"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSpan(v);
                }}
                aria-pressed={span === v}
                title={v === 7 ? "Next week" : v === 14 ? "Next 2 weeks" : "Next month"}
                className={cn(
                  "rounded px-1 text-[10px] font-semibold",
                  span === v ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="font-display text-xl font-bold">{hkdExact(forecast)}</div>
          <div className="text-[10px] text-muted-foreground">
            {ahead.length} gig{ahead.length === 1 ? "" : "s"} until{" "}
            {fmtDay(until, { day: "numeric", month: "short" })} ·{" "}
            <span className="font-medium text-primary">My rate</span>
          </div>
        </div>
      </div>
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My hourly rate</DialogTitle>
          </DialogHeader>
          {mainPos ? (
            <RateSuggest userId={me.id} name={me.fullName} positionId={mainPos} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Your main position isn't set yet. Ask the office to add it.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">
            Invitations <span className="text-accent-foreground">({pending.length})</span>
          </h2>
          {pending.map((i) => (
            <InvitationCard key={i.id} inv={i} all={data} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Upcoming</h2>
        {gigs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No upcoming gigs yet. Keep your{" "}
            <Link to="/availability" className="text-primary underline">
              availability
            </Link>{" "}
            up to date.
          </p>
        )}
        {gigs.map((i) => (
          <GigCard key={i.id} inv={i} />
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold">{value}</div>
    </div>
  );
}

function GigCard({ inv }: { inv: MyInvitation }) {
  const e = inv.events!;
  const r = inv.staffing_rows!;
  const { data: team = [] } = useQuery({
    queryKey: ["team", e.id],
    enabled: inv.status === "confirmed",
    queryFn: async () => (await supabase.rpc("event_team", { _event: e.id })).data ?? [],
  });
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-primary">
            {fmtDay(e.day, { weekday: "long", day: "numeric", month: "short" })}
          </div>
          <div className="font-display text-lg font-bold">{e.title}</div>
          <div className="text-sm text-muted-foreground">
            {r.positions?.name} · {hhmm(r.start_time)}–{hhmm(r.end_time)}
          </div>
        </div>
        {inv.status === "accepted" && (
          <span className="rounded-full bg-warning/30 px-2 py-0.5 text-xs">
            Awaiting confirmation
          </span>
        )}
      </div>
      {e.venue && (
        <a
          className="mt-2 flex items-center gap-1.5 text-sm text-primary"
          target="_blank"
          rel="noreferrer"
          href={`https://maps.google.com/?q=${encodeURIComponent(e.venue)}`}
        >
          <MapPin className="h-4 w-4" /> {e.venue}
        </a>
      )}
      {team.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="mb-1 text-xs font-semibold text-muted-foreground">Team</div>
          <div className="flex flex-wrap gap-1.5">
            {team.map((t) => (
              <span
                key={t.user_id + t.position_name}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {t.full_name} · {t.position_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
