import { isPublicHoliday, shiftPay } from "@/lib/pay";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, MapPin, Trash2, MessageCircle, Megaphone, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePositions } from "@/lib/me";
import { getOrderDetails } from "@/lib/puree.functions";
import { fmtDay, hhmm, hkd, shiftHours } from "@/lib/time";
import { clientChargeForShift, staffCost } from "@/lib/costs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CallStaffDialog } from "@/components/app/CallStaffDialog";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/app/Avatar";

export const Route = createFileRoute("/_authenticated/events/$id")({
  head: () => ({ meta: [{ title: "Event — Gig Agenda" }, { name: "description", content: "Event staffing and team." }, { property: "og:title", content: "Event — Gig Agenda" }, { property: "og:description", content: "Event staffing and team." }] }),
  component: EventPage,
});

function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const full = digits.length === 8 ? "852" + digits : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

const STATUS_STYLE: Record<string, string> = {
  invited: "bg-secondary text-secondary-foreground",
  accepted: "bg-warning/30 text-accent-foreground",
  confirmed: "bg-success/20 text-success",
  declined: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive line-through",
  closed: "bg-muted text-muted-foreground",
};

function EventPage() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const details = useServerFn(getOrderDetails);

  const { data: ev } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => (await supabase.from("events").select("*").eq("id", id).single()).data,
  });
  const { data: puree } = useQuery({
    queryKey: ["puree-details", id],
    enabled: !!me?.isOffice && ev?.source === "puree",
    queryFn: () => details({ data: { eventId: id } }),
    retry: false,
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team", id],
    queryFn: async () => (await supabase.rpc("event_team", { _event: id })).data ?? [],
  });

  if (!ev || !me) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("rounded px-1.5 py-0.5 font-bold", ev.account === "gingers" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground")}>
            {ev.source === "manual" ? "Manual" : ev.account === "gingers" ? "Gingers" : "Relish"}
          </span>
          {ev.reference && <span className="text-muted-foreground">#{ev.reference}</span>}
          {ev.state && <span className="text-muted-foreground capitalize">{ev.state}</span>}
        </div>
        <h1 className="text-3xl font-bold">{ev.title}</h1>
        <p className="text-muted-foreground">
          {fmtDay(ev.day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {ev.start_time && ` · ${hhmm(ev.start_time)}`}{ev.end_time && `–${hhmm(ev.end_time)}`}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {ev.client_name && <span>Client: <b>{ev.client_name}</b></span>}
          {ev.pax && <span>{ev.pax} guests</span>}
          {(puree?.venue || ev.venue) && (
            <a className="inline-flex items-center gap-1 text-primary" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(puree?.venue || ev.venue || "")}`}>
              <MapPin className="h-4 w-4" /> {puree?.venue || ev.venue}
            </a>
          )}
          {me.isOffice && ev.order_url && (
            <a className="inline-flex items-center gap-1 text-primary" href={ev.order_url} target="_blank" rel="noreferrer">Open in Puree <ExternalLink className="h-3.5 w-3.5" /></a>
          )}
        </div>
        {me.isOffice && puree?.deliveries?.length ? <p className="text-sm text-muted-foreground">Delivery: {puree.deliveries.join(", ")}</p> : null}
      </header>

      {me.isOffice && puree?.items?.length ? (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Menu ({puree.items.length} items)</summary>
          <ul className="mt-2 space-y-0.5 text-sm">{puree.items.map((i, k) => <li key={k}>{i.quantity ? `${i.quantity} × ` : ""}{i.name}</li>)}</ul>
        </details>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Team</h2>
        {team.length === 0 ? <p className="text-sm text-muted-foreground">No one confirmed yet.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {team.map((t) => (
              <div key={t.user_id + t.position_name} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                <Avatar name={t.full_name} url={t.photo_url} />
                <div className="text-sm"><div className="font-semibold">{t.full_name}</div><div className="text-muted-foreground">{t.position_name} · {hhmm(t.start_time)}–{hhmm(t.end_time)}</div></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {me.isOffice && <OfficeStaffing eventId={id} ev={ev} onChange={() => { qc.invalidateQueries({ queryKey: ["team", id] }); qc.invalidateQueries({ queryKey: ["events"] }); }} />}
    </div>
  );
}

type EventRow = { id: string; title: string; day: string; venue: string | null; start_time: string | null; notes?: string | null };

function OfficeStaffing({ eventId, ev, onChange }: { eventId: string; ev: EventRow; onChange: () => void }) {
  const qc = useQueryClient();
  const { data: positions = [] } = usePositions();
  const [callRow, setCallRow] = useState<string | null>(null);
  const [applyOt, setApplyOt] = useState(false);
  const [form, setForm] = useState({ position_id: "", quantity: "1", start_time: hhmm(ev.start_time) || "17:30", end_time: "22:30", break_minutes: "0" });

  const { data: rows = [] } = useQuery({
    queryKey: ["rows", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staffing_rows")
        .select("*, positions(name,color), invitations(*, profiles(id,full_name,phone,photo_url,personal_hourly_cost))")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const { data: rates = [] } = useQuery({ queryKey: ["rates"], queryFn: async () => (await supabase.from("position_rates").select("*")).data ?? [] });
  const { data: ot = [] } = useQuery({ queryKey: ["overtime"], queryFn: async () => (await supabase.from("overtime_rates").select("*").order("sort")).data ?? [] });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["rows", eventId] }); onChange(); };

  async function addRow(e: React.FormEvent) {
    e.preventDefault();
    if (!form.position_id) return toast.error("Pick a position");
    const { error } = await supabase.from("staffing_rows").insert({ event_id: eventId, position_id: form.position_id, quantity: Number(form.quantity), start_time: form.start_time, end_time: form.end_time, break_minutes: Number(form.break_minutes) });
    if (error) return toast.error(error.message);
    refresh();
  }
  async function delRow(id: string) {
    if (!confirm("Remove this staffing row and its invitations?")) return;
    await supabase.from("staffing_rows").delete().eq("id", id);
    refresh();
  }
  async function setStatus(invId: string, status: "confirmed" | "cancelled") {
    const { error } = await supabase.from("invitations").update({ status }).eq("id", invId);
    if (error) toast.error(error.message);
    refresh();
  }

  const rateOf = (pid: string) => rates.find((r) => r.position_id === pid);
  let totalCost = 0, totalCharge = 0, missingRates = false;
  const costLines: { name: string; position: string; hours: number; cost: number | null }[] = [];
  rows.forEach((r) => {
    const hours = shiftHours(r.start_time, r.end_time, r.break_minutes);
    const rate = rateOf(r.position_id);
    const people = r.invitations.filter((i) => i.status === "confirmed" || i.status === "accepted");
    people.forEach((i) => {
      const c = shiftPay({ position: r.positions?.name, start: r.start_time, end: r.end_time, breakMinutes: r.break_minutes, personalRate: i.profiles?.personal_hourly_cost, positionRate: rate?.hourly_cost, publicHoliday: isPublicHoliday(ev.notes) });
      if (c == null) missingRates = true;
      totalCost += c ?? 0;
      costLines.push({ name: i.profiles?.full_name ?? "", position: r.positions?.name ?? "", hours, cost: c });
    });
    if (rate?.client_rate == null) missingRates = true;
    totalCharge += r.quantity * clientChargeForShift(r.start_time, r.end_time, r.break_minutes, Number(rate?.client_rate ?? 0), ot.map((o) => ({ ...o, client_rate: Number(o.client_rate) })), applyOt);
  });

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Staffing plan</h2>
        {rows.map((r) => {
          const filled = r.invitations.filter((i) => i.status === "accepted" || i.status === "confirmed").length;
          const groups = ["confirmed", "accepted", "invited", "declined", "cancelled", "closed"] as const;
          const msg = `Hi! Gig Agenda: ${r.positions?.name} at ${ev.title}, ${fmtDay(ev.day)} ${hhmm(r.start_time)}–${hhmm(r.end_time)}${ev.venue ? ", " + ev.venue : ""}. Please check your invitation in the app.`;
          return (
            <div key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.positions?.name}</span>
                <span className="text-sm">{r.quantity} needed</span>
                <span className="text-sm text-muted-foreground">{hhmm(r.start_time)}–{hhmm(r.end_time)}{r.break_minutes ? ` · ${r.break_minutes} min break` : ""}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", filled >= r.quantity ? "bg-success/20 text-success" : "bg-warning/30 text-accent-foreground")}>{filled} of {r.quantity} accepted</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" onClick={() => setCallRow(r.id)} disabled={filled >= r.quantity}><Megaphone className="h-4 w-4" /> Call staff</Button>
                  <Button size="icon" variant="ghost" onClick={() => delRow(r.id)} aria-label="Remove row"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {r.invitations.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {groups.flatMap((g) => r.invitations.filter((i) => i.status === g)).map((i) => (
                    <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Avatar name={i.profiles?.full_name ?? "?"} url={i.profiles?.photo_url} size={28} />
                      <span className="font-medium">{i.profiles?.full_name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs capitalize", STATUS_STYLE[i.status])}>{i.status}{i.mode === "broadcast" && i.status === "invited" ? " · first-come" : ""}</span>
                      {i.decline_reason && <span className="text-xs text-muted-foreground">“{i.decline_reason}”</span>}
                      <div className="ml-auto flex gap-1">
                        {i.status === "accepted" && <Button size="sm" variant="outline" onClick={() => setStatus(i.id, "confirmed")}><Check className="h-4 w-4" /> Confirm</Button>}
                        {(i.status === "accepted" || i.status === "confirmed" || i.status === "invited") && (
                          <Button size="icon" variant="ghost" onClick={() => setStatus(i.id, "cancelled")} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                        )}
                        {i.profiles?.phone && (
                          <a href={waLink(i.profiles.phone, msg)} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-success hover:bg-secondary" aria-label="WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <form onSubmit={addRow} className="grid grid-cols-2 gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[1.5fr_4rem_1fr_1fr_5rem_auto] sm:items-end">
          <div className="col-span-2 grid gap-1 sm:col-span-1">
            <Label className="text-xs">Position</Label>
            <Select value={form.position_id} onValueChange={(v) => setForm({ ...form, position_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label className="text-xs">How many</Label><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="grid gap-1"><Label className="text-xs">Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
          <div className="grid gap-1"><Label className="text-xs">End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
          <div className="grid gap-1"><Label className="text-xs">Break (min)</Label><Input type="number" min={0} value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value })} /></div>
          <Button type="submit" className="col-span-2 sm:col-span-1">Add</Button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="mr-auto text-xl font-bold">Costs</h2>
          <Switch id="ot" checked={applyOt} onCheckedChange={setApplyOt} />
          <Label htmlFor="ot" className="text-sm">After-midnight rates</Label>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground"><tr><th className="p-2">Person</th><th className="p-2">Position</th><th className="p-2 text-right">Hours</th><th className="p-2 text-right">Cost</th></tr></thead>
            <tbody>
              {costLines.map((l, k) => (
                <tr key={k} className="border-t"><td className="p-2">{l.name}</td><td className="p-2">{l.position}</td><td className="p-2 text-right">{l.hours.toFixed(1)}</td><td className="p-2 text-right">{hkd(l.cost)}</td></tr>
              ))}
              {costLines.length === 0 && <tr><td colSpan={4} className="p-3 text-muted-foreground">Costs appear once people accept.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Staff cost" value={hkd(totalCost)} />
          <Stat label="Charge to client" value={hkd(totalCharge)} />
          <Stat label="Margin" value={totalCharge ? `${hkd(totalCharge - totalCost)} · ${Math.round(((totalCharge - totalCost) / totalCharge) * 100)}%` : "—"} />
        </div>
        {missingRates && <p className="text-xs text-muted-foreground">Some hourly rates are empty — fill them in under <Link to="/settings" className="text-primary underline">Rates</Link>.</p>}
      </section>

      {callRow && (
        <CallStaffDialog
          row={rows.find((r) => r.id === callRow)!}
          ev={ev}
          onClose={() => setCallRow(null)}
          onSent={() => { setCallRow(null); refresh(); }}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}
