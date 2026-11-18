import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePositions } from "@/lib/me";
import { coversShift, overlaps, resolveAvail, type DayAvail } from "@/lib/availability";
import { addDays, fmtDay, hhmm, hkToday, parseDay, shiftHours } from "@/lib/time";
import { demoStatus, removeDemo } from "@/lib/demo.functions";
import { PositionLabel } from "@/components/app/PositionLabel";
import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invite")({
  head: () => ({ meta: [{ title: "Invitations — Gig Agenda" }, { name: "description", content: "Invite staff to events on chosen dates." }, { property: "og:title", content: "Invitations — Gig Agenda" }, { property: "og:description", content: "Invite staff to events on chosen dates." }] }),
  component: InvitePage,
});

const ACTIVE = ["accepted", "confirmed", "live", "processing"];
const availText = (a: DayAvail | null) =>
  !a ? "No answer" : a.status === "available" ? "Available" : a.status === "partial" ? `${hhmm(a.start_time)}–${hhmm(a.end_time)}` : "Unavailable";
const availCls = (a: DayAvail | null) =>
  !a ? "" : a.status === "available" ? "bg-success/25" : a.status === "partial" ? "bg-warning/35" : "bg-destructive/15";

function InvitePage() {
  const today = hkToday();
  const qc = useQueryClient();
  const { data: positions = [] } = usePositions();
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i));
  const horizon = days[days.length - 1]!;

  // Upcoming confirmed events (Puree) and events added by hand.
  const { data: events = [] } = useQuery({
    queryKey: ["invite-events", today, horizon],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id,day,title,client_name,start_time,state,account,reference,source,venue").gte("day", today).lte("day", horizon).order("day").order("start_time");
      return (data ?? []).filter((e) => e.source === "manual" || ACTIVE.includes(String(e.state ?? "").toLowerCase()));
    },
  });

  const [picked, setPicked] = useState<string[]>([]);
  const [eventFor, setEventFor] = useState<Record<string, string>>({});
  const [positionId, setPositionId] = useState("");
  const [start, setStart] = useState("17:30");
  const [end, setEnd] = useState("22:30");
  const [replyHours, setReplyHours] = useState("24");
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Default the event of a picked day to its only event.
  const eventOf = (d: string) => eventFor[d] ?? (events.filter((e) => e.day === d).length === 1 ? events.find((e) => e.day === d)!.id : "");

  const { data: people } = useQuery({
    queryKey: ["invite-people", picked.join(",")],
    queryFn: async () => {
      const [p, a, pt, booked] = await Promise.all([
        supabase.from("profiles").select("id,full_name,photo_url,main_position_id,other_position_ids,personal_hourly_cost,active").eq("active", true).order("full_name"),
        picked.length ? supabase.from("availability").select("*").in("day", picked) : Promise.resolve({ data: [] }),
        supabase.from("availability_patterns").select("*"),
        picked.length
          ? supabase.from("invitations").select("user_id,status,staffing_rows!inner(start_time,end_time),events!inner(day,title)").in("events.day", picked).in("status", ["accepted", "confirmed"])
          : Promise.resolve({ data: [] }),
      ]);
      return { profiles: p.data ?? [], avail: (a.data ?? []) as (DayAvail & { user_id: string; day: string })[], patterns: (pt.data ?? []) as (DayAvail & { user_id: string; weekday: number })[], booked: (booked.data ?? []) as { user_id: string; staffing_rows: { start_time: string; end_time: string }; events: { day: string; title: string } }[] };
    },
  });
  const { data: rates = [] } = useQuery({ queryKey: ["rates"], queryFn: async () => (await supabase.from("position_rates").select("*")).data ?? [] });

  const position = positions.find((p) => p.id === positionId);
  const cell = (uid: string, d: string) =>
    resolveAvail(d, people?.avail.find((x) => x.user_id === uid && x.day === d), people?.patterns.filter((x) => x.user_id === uid));
  const clash = (uid: string, d: string) =>
    people?.booked.find((b) => b.user_id === uid && b.events.day === d && overlaps(b.staffing_rows.start_time, b.staffing_rows.end_time, start, end));
  const fits = (uid: string, d: string) => !clash(uid, d) && coversShift(cell(uid, d), start, end);

  const eligible = useMemo(
    () =>
      (people?.profiles ?? []).filter((p) => !positionId || p.main_position_id === positionId || (p.other_position_ids ?? []).includes(positionId)),
    [people, positionId],
  );
  const rateOf = (p: { personal_hourly_cost: number | null }) =>
    p.personal_hourly_cost ?? rates.find((r) => r.position_id === positionId)?.hourly_cost ?? null;

  async function send() {
    if (!picked.length || !chosen.length || !positionId) return toast.error("Pick the dates, the position and at least one person");
    const missing = picked.filter((d) => !eventOf(d));
    if (missing.length) return toast.error(`Choose the event for ${missing.map((d) => fmtDay(d)).join(", ")}`);
    setBusy(true);
    try {
      const deadline = new Date(Date.now() + Number(replyHours || 24) * 3600_000).toISOString();
      let sent = 0;
      for (const d of picked) {
        const eventId = eventOf(d);
        // Same position and hours on the event: reuse that shift and make room for the people invited.
        const { data: rows } = await supabase.from("staffing_rows").select("id,quantity,start_time,end_time").eq("event_id", eventId).eq("position_id", positionId);
        let row = (rows ?? []).find((r) => hhmm(r.start_time) === start && hhmm(r.end_time) === end);
        if (!row) {
          const { data: created, error } = await supabase.from("staffing_rows").insert({ event_id: eventId, position_id: positionId, quantity: chosen.length, start_time: start, end_time: end, break_minutes: 0 }).select("id,quantity,start_time,end_time").single();
          if (error) throw error;
          row = created;
        }
        const { error } = await supabase.from("invitations").upsert(
          chosen.map((user_id) => ({ staffing_row_id: row!.id, event_id: eventId, user_id, mode: "direct", deadline, status: "invited" as const, decline_reason: null, responded_at: null })),
          { onConflict: "staffing_row_id,user_id" },
        );
        if (error) throw error;
        sent += chosen.length;
      }
      toast.success(`${sent} invitation${sent === 1 ? "" : "s"} sent`);
      setChosen([]);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sortedPositions = [...positions].sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Invitations</h1>
      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Send invitations</TabsTrigger>
          <TabsTrigger value="replies">Replies</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">1. Dates and event</h2>
            <div className="flex flex-wrap gap-1.5">
              {days.map((d) => {
                const n = events.filter((e) => e.day === d).length;
                const on = picked.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== d) : [...p, d].sort()))}
                    className={cn("min-w-16 rounded-lg border px-2 py-1 text-xs", on ? "border-primary bg-primary text-primary-foreground" : n ? "hover:bg-secondary" : "text-muted-foreground hover:bg-secondary")}
                  >
                    <div className="font-medium">{parseDay(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</div>
                    <div className={cn("text-[10px]", on ? "opacity-90" : "text-muted-foreground")}>{n ? `${n} event${n === 1 ? "" : "s"}` : "—"}</div>
                  </button>
                );
              })}
            </div>
            {picked.map((d) => {
              const list = events.filter((e) => e.day === d);
              return (
                <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-32 font-medium">{fmtDay(d)}</span>
                  {list.length ? (
                    <Select value={eventOf(d) || "none"} onValueChange={(v) => setEventFor((m) => ({ ...m, [d]: v === "none" ? "" : v }))}>
                      <SelectTrigger className="w-96"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Choose the event…</SelectItem>
                        {list.map((e) => <SelectItem key={e.id} value={e.id}>{e.source === "manual" ? "M" : e.account === "gingers" ? "G" : "R"}{e.reference ? ` #${e.reference}` : ""} · {e.client_name ?? e.title}{e.start_time ? ` · ${hhmm(e.start_time)}` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">No event this day – add one on the <Link to="/home" className="underline">Events</Link> page.</span>
                  )}
                </div>
              );
            })}
          </section>

          <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
            <h2 className="w-full font-semibold">2. Position and hours</h2>
            <div className="space-y-1"><Label>Position</Label>
              <Select value={positionId} onValueChange={(v) => { setPositionId(v); setChosen([]); }}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{sortedPositions.map((p) => <SelectItem key={p.id} value={p.id}><PositionLabel name={p.name} color={p.color} /></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>From</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" /></div>
            <div className="space-y-1"><Label>To</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-32" /></div>
            <div className="space-y-1"><Label>Reply within (hours)</Label><Input type="number" min={1} value={replyHours} onChange={(e) => setReplyHours(e.target.value)} className="w-28" /></div>
            <span className="pb-2 text-sm text-muted-foreground">{shiftHours(start, end).toFixed(1)} h</span>
          </section>

          <section className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-semibold">3. Who to invite</h2>
              <Button variant="ghost" size="sm" disabled={!picked.length} onClick={() => setChosen(eligible.filter((w) => picked.every((d) => fits(w.id, d))).map((w) => w.id))}>Select everyone available</Button>
            </div>
            {!positionId && <p className="text-sm text-muted-foreground">Choose a position to see the staff who do it.</p>}
            {positionId && !picked.length && <p className="text-sm text-muted-foreground">Pick dates to see who is available.</p>}
            {positionId && (
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2" /><th className="p-2">Name</th><th className="p-2">Rate</th>{picked.map((d) => <th key={d} className="p-2">{fmtDay(d)}</th>)}</tr></thead>
                  <tbody>
                    {eligible.map((w) => {
                      const ok = picked.length > 0 && picked.every((d) => fits(w.id, d));
                      const rate = rateOf(w);
                      return (
                        <tr key={w.id} className={cn("border-t", !ok && picked.length > 0 && "text-muted-foreground")}>
                          <td className="p-2"><Checkbox checked={chosen.includes(w.id)} onCheckedChange={(c) => setChosen((x) => (c ? [...x, w.id] : x.filter((y) => y !== w.id)))} aria-label={`Invite ${w.full_name}`} /></td>
                          <td className="p-2"><span className="flex items-center gap-2 font-medium"><Avatar name={w.full_name} url={w.photo_url} size={26} />{w.full_name}</span></td>
                          <td className="p-2 tabular-nums">{rate != null ? `HK$${rate}/h` : "—"}</td>
                          {picked.map((d) => {
                            const c = clash(w.id, d);
                            const a = cell(w.id, d);
                            return <td key={d} className={cn("p-2 text-xs", c ? "bg-destructive/15" : availCls(a))}>{c ? `Booked: ${c.events.title}` : availText(a)}</td>;
                          })}
                        </tr>
                      );
                    })}
                    {!eligible.length && <tr><td colSpan={3 + picked.length} className="p-2 text-muted-foreground">No active staff for this position.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <Button onClick={send} disabled={busy || !picked.length || !chosen.length || !positionId} className="gap-1.5">
              <Send className="h-4 w-4" />{busy ? "Sending…" : `Send ${chosen.length * picked.length || ""} invitation${chosen.length * picked.length === 1 ? "" : "s"}`}
            </Button>
          </section>
        </TabsContent>

        <TabsContent value="replies">
          <Replies today={today} />
        </TabsContent>
      </Tabs>
      <DemoLeftovers />
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  invited: "",
  accepted: "border-warning text-accent-foreground",
  confirmed: "border-success text-success",
  declined: "border-destructive text-destructive",
  cancelled: "border-destructive text-destructive",
  closed: "text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = { invited: "Waiting", accepted: "Accepted", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled", closed: "Slots filled" };

/** Invitations for upcoming events and their answers. */
function Replies({ today }: { today: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["invite-replies", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id,status,decline_reason,responded_at,user_id, profiles(full_name,photo_url), events!inner(id,day,title,client_name,account,reference,source), staffing_rows(start_time,end_time, positions(name,color))")
        .gte("events.day", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const sorted = [...data].sort((a, b) => (a.events?.day ?? "").localeCompare(b.events?.day ?? ""));
  const count = (s: string) => data.filter((i) => i.status === s).length;
  async function confirm(id: string) {
    const { error } = await supabase.from("invitations").update({ status: "confirmed" }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">Waiting {count("invited")}</Badge>
        <Badge variant="outline" className={STATUS_STYLE["accepted"]}>Accepted {count("accepted")}</Badge>
        <Badge variant="outline" className={STATUS_STYLE["confirmed"]}>Confirmed {count("confirmed")}</Badge>
        <Badge variant="outline" className={STATUS_STYLE["declined"]}>Declined {count("declined")}</Badge>
      </div>
      {!sorted.length ? (
        <p className="text-sm text-muted-foreground">No invitations for upcoming events yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs"><tr><th className="p-2">Date</th><th className="p-2">Event</th><th className="p-2">Position</th><th className="p-2">Hours</th><th className="p-2">Worker</th><th className="p-2">Answer</th><th className="p-2" /></tr></thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{fmtDay(i.events!.day)}</td>
                  <td className="p-2"><Link to="/events/$id" params={{ id: i.events!.id }} className="hover:underline">{i.events!.source === "manual" ? "M" : i.events!.account === "gingers" ? "G" : "R"}{i.events!.reference ? ` #${i.events!.reference}` : ""} · {i.events!.client_name ?? i.events!.title}</Link></td>
                  <td className="p-2"><PositionLabel name={i.staffing_rows?.positions?.name} color={i.staffing_rows?.positions?.color} /></td>
                  <td className="p-2 whitespace-nowrap">{hhmm(i.staffing_rows?.start_time)}–{hhmm(i.staffing_rows?.end_time)}</td>
                  <td className="p-2"><span className="flex items-center gap-2"><Avatar name={i.profiles?.full_name ?? "?"} url={i.profiles?.photo_url} size={24} />{i.profiles?.full_name}</span></td>
                  <td className="p-2"><Badge variant="outline" className={STATUS_STYLE[i.status]}>{STATUS_LABEL[i.status] ?? i.status}</Badge>{i.decline_reason ? <span className="ml-1 text-xs text-muted-foreground">“{i.decline_reason}”</span> : null}</td>
                  <td className="p-2 text-right">{i.status === "accepted" && <Button size="sm" variant="outline" onClick={() => confirm(i.id)}>Confirm</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Only shown while the sample workers from the old demo are still in the app. */
function DemoLeftovers() {
  const qc = useQueryClient();
  const status = useServerFn(demoStatus);
  const remove = useServerFn(removeDemo);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ["demo-status"], queryFn: () => status() });
  if (!data?.workers) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
      <span className="mr-auto text-muted-foreground">{data.workers} sample workers and their "DEMO ·" events from the old demo are still in the app.</span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await remove();
            toast.success("Sample workers and events removed");
            await qc.invalidateQueries();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Remove them
      </Button>
    </div>
  );
}
