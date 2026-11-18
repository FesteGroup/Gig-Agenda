import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, fmtDay, hhmm, hkToday, hkd, shiftHours } from "@/lib/time";
import { isPublicHoliday, shiftPay } from "@/lib/pay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Reports — Gig Agenda" }, { name: "description", content: "Payroll export and open slots." }, { property: "og:title", content: "Reports — Gig Agenda" }, { property: "og:description", content: "Payroll export and open slots." }] }),
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

  const { data: open = [] } = useQuery({
    queryKey: ["open-slots", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,day,start_time,account,source,state, staffing_rows(quantity, positions(name), invitations(status))")
        .gte("day", today)
        .lte("day", addDays(today, 30))
        .order("day");
      return (data ?? [])
        .map((e) => {
          const missing = e.staffing_rows.map((r) => ({ pos: r.positions?.name ?? "", n: r.quantity - r.invitations.filter((i) => i.status === "accepted" || i.status === "confirmed").length })).filter((x) => x.n > 0);
          return { ...e, missing };
        })
        // Confirmed events only (no quotes).
        .filter((e) => e.missing.length && (e.source === "manual" || ["accepted", "confirmed", "live", "processing"].includes(String(e.state ?? "").toLowerCase())));
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
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">Still to staff</h1>
        <p className="text-sm text-muted-foreground">Next 30 days, events with empty slots.</p>
        {open.length === 0 && <p className="text-sm text-muted-foreground">All planned slots are filled.</p>}
        <div className="divide-y rounded-xl border bg-card">
          {open.map((e) => (
            <Link key={e.id} to="/events/$id" params={{ id: e.id }} className="flex flex-wrap items-center gap-2 p-3 hover:bg-secondary">
              <span className="w-28 text-sm font-semibold">{fmtDay(e.day)} {hhmm(e.start_time)}</span>
              <span className="flex-1 font-medium">{e.title}</span>
              <span className="text-sm text-destructive">{e.missing.map((m) => `${m.n} ${m.pos}`).join(", ")} missing</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-2xl font-bold">Payroll</h2>
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
  );
}
