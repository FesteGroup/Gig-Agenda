import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, fmtDay, hhmm, hkToday, hkd, hkdExact, shiftHours } from "@/lib/time";
import { isPublicHoliday, shiftPay } from "@/lib/pay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Reports — Gig Agenda" }, { name: "description", content: "Payroll and forecast staff cost." }, { property: "og:title", content: "Reports — Gig Agenda" }, { property: "og:description", content: "Payroll and forecast staff cost." }] }),
  component: Page,
});

function lastDay(month: string) {
  const [y = 2026, m = 1] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

function Page() {
  const [month, setMonth] = useState(hkToday().slice(0, 7));
  const today = hkToday();

  const { data: lines = [] } = useQuery({
    queryKey: ["payroll", month],
    queryFn: async () => {
      const [inv, rates] = await Promise.all([
        supabase
          .from("invitations")
          .select("id, profiles(full_name,personal_hourly_cost), events!inner(title,day,notes), staffing_rows(position_id,start_time,end_time,break_minutes,positions(name))")
          .eq("status", "confirmed")
          .gte("events.day", `${month}-01`)
          .lte("events.day", lastDay(month)),
        supabase.from("position_rates").select("*"),
      ]);
      return (inv.data ?? [])
        .map((i) => {
          const r = i.staffing_rows!;
          const hours = shiftHours(r.start_time, r.end_time, r.break_minutes);
          const rate = i.profiles?.personal_hourly_cost ?? rates.data?.find((x) => x.position_id === r.position_id)?.hourly_cost ?? null;
          const amount = shiftPay({ position: r.positions?.name, start: r.start_time, end: r.end_time, breakMinutes: r.break_minutes, personalRate: i.profiles?.personal_hourly_cost, positionRate: rates.data?.find((x) => x.position_id === r.position_id)?.hourly_cost, publicHoliday: isPublicHoliday(i.events!.notes, i.events!.day) });
          return { staff: i.profiles?.full_name ?? "", event: i.events!.title, date: i.events!.day, position: r.positions?.name ?? "", hours, rate, amount };
        })
        .sort((a, b) => a.staff.localeCompare(b.staff) || a.date.localeCompare(b.date));
    },
  });

  function download() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Staff", "Event", "Date", "Position", "Hours", "Hourly cost (HKD)", "Amount (HKD)"], ...lines.map((l) => [l.staff, l.event, l.date, l.position, l.hours.toFixed(2), l.rate ?? "", l.amount?.toFixed(2) ?? ""])]
      .map((r) => r.map(esc).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `gig-agenda-payroll-${month}.csv`;
    a.click();
  }

  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <div className="min-w-0 space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-3xl font-bold">Payroll</h1>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button onClick={download} disabled={!lines.length}><Download className="h-4 w-4" /> CSV</Button>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground"><tr><th className="p-2">Staff</th><th className="p-2">Event</th><th className="p-2">Date</th><th className="p-2 text-right">Hours</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th></tr></thead>
            <tbody>
              {lines.map((l, k) => (
                <tr key={k} className="border-t"><td className="p-2">{l.staff}</td><td className="p-2">{l.event}</td><td className="p-2">{fmtDay(l.date)}</td><td className="p-2 text-right">{l.hours.toFixed(1)}</td><td className="p-2 text-right">{hkd(l.rate)}</td><td className="p-2 text-right">{hkd(l.amount)}</td></tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6} className="p-3 text-muted-foreground">No confirmed gigs this month.</td></tr>}
            </tbody>
            {lines.length > 0 && <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={5}>Total</td><td className="p-2 text-right">{hkd(total)}</td></tr></tfoot>}
          </table>
        </div>
      </section>
      </div>
      <div className="min-w-0"><Forecast today={today} /></div>
    </div>
  );
}

/** Staff cost to come: accepted and confirmed invitations, priced on each shift's hours and the worker's rate. */
function Forecast({ today }: { today: string }) {
  const [span, setSpan] = useState<"7" | "14" | "30">("7");
  const end = addDays(today, Number(span) - 1);
  const { data: shifts = [] } = useQuery({
    queryKey: ["forecast", today, end],
    queryFn: async () => {
      const [inv, rates] = await Promise.all([
        supabase
          .from("invitations")
          .select("id,status,user_id, profiles(full_name,personal_hourly_cost), events!inner(id,title,client_name,day,notes), staffing_rows(position_id,start_time,end_time,break_minutes,positions(name))")
          .in("status", ["accepted", "confirmed"])
          .gte("events.day", today)
          .lte("events.day", end),
        supabase.from("position_rates").select("*"),
      ]);
      return (inv.data ?? []).filter((i) => i.staffing_rows).map((i) => {
        const r = i.staffing_rows!;
        const positionRate = rates.data?.find((x) => x.position_id === r.position_id)?.hourly_cost;
        const cost = shiftPay({ position: r.positions?.name, start: r.start_time, end: r.end_time, breakMinutes: r.break_minutes, personalRate: i.profiles?.personal_hourly_cost, positionRate, publicHoliday: isPublicHoliday(i.events!.notes, i.events!.day) });
        return { id: i.id, user: i.user_id, name: i.profiles?.full_name ?? "", status: i.status, eventId: i.events!.id, event: i.events!.client_name ?? i.events!.title, day: i.events!.day, start: r.start_time, end: r.end_time, hours: shiftHours(r.start_time, r.end_time, r.break_minutes), cost };
      });
    },
  });
  const total = shifts.reduce((t, x) => t + (x.cost ?? 0), 0);
  const hours = shifts.reduce((t, x) => t + x.hours, 0);
  const noRate = shifts.filter((x) => x.cost == null).length;
  const people = [...new Set(shifts.map((x) => x.user))]
    .map((u) => {
      const l = shifts.filter((x) => x.user === u).sort((a, b) => a.day.localeCompare(b.day));
      return { user: u, name: l[0]!.name, list: l, hours: l.reduce((t, x) => t + x.hours, 0), cost: l.reduce((t, x) => t + (x.cost ?? 0), 0) };
    })
    .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">Forecast staff cost</h1>
        <ToggleGroup type="single" value={span} onValueChange={(v) => v && setSpan(v as typeof span)} variant="outline" size="sm">
          <ToggleGroupItem value="7">Week</ToggleGroupItem>
          <ToggleGroupItem value="14">2 weeks</ToggleGroupItem>
          <ToggleGroupItem value="30">Month</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-sm text-muted-foreground">{fmtDay(today)} to {fmtDay(end)} · accepted and confirmed invitations, on each shift's hours.</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">Forecast cost</div><div className="text-xl font-bold">{hkdExact(total)}</div></div>
        <div className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">Hours</div><div className="text-xl font-bold">{hours.toFixed(1)} h</div></div>
        <div className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">Shifts</div><div className="text-xl font-bold">{shifts.length} <span className="text-sm font-normal text-muted-foreground">· {people.length} workers</span></div></div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground"><tr><th className="p-2">Worker</th><th className="p-2">Shifts</th><th className="p-2 text-right">Hours</th><th className="p-2 text-right">Cost</th></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.user} className="border-t align-top">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2">
                  <div className="space-y-0.5">
                    {p.list.map((x) => (
                      <div key={x.id} className="text-xs">
                        <Link to="/events/$id" params={{ id: x.eventId }} className="hover:underline">{fmtDay(x.day)} · {x.event}</Link>
                        <span className="text-muted-foreground"> · {hhmm(x.start)}–{hhmm(x.end)} · {x.hours.toFixed(1)} h{x.status === "accepted" ? " · not confirmed yet" : ""}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-2 text-right tabular-nums">{p.hours.toFixed(1)}</td>
                <td className="p-2 text-right tabular-nums">{hkdExact(p.cost)}</td>
              </tr>
            ))}
            {people.length === 0 && <tr><td colSpan={4} className="p-3 text-muted-foreground">No accepted invitations in this period.</td></tr>}
          </tbody>
          {people.length > 0 && <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>Total</td><td className="p-2 text-right tabular-nums">{hours.toFixed(1)}</td><td className="p-2 text-right tabular-nums">{hkdExact(total)}</td></tr></tfoot>}
        </table>
      </div>
      {noRate > 0 && <p className="text-xs text-muted-foreground">{noRate} shift{noRate > 1 ? "s have" : " has"} no hourly rate and {noRate > 1 ? "are" : "is"} not counted – fill it in under <Link to="/settings" className="text-primary underline">Rates</Link>.</p>}
    </section>
  );
}
