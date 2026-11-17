import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addDays, fmtDay, hkToday, parseDay } from "@/lib/time";
import { shiftHours } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { DEMO_WORKERS, demoAvail, type DemoStatus, type DemoWorker } from "@/lib/demo-data";
import { demoStatus, removeDemo, seedDemo } from "@/lib/demo.functions";

export const Route = createFileRoute("/_authenticated/demo")({
  head: () => ({ meta: [{ title: "Demo — Gig Agenda" }, { name: "description", content: "Try sending invitations to sample staff." }, { property: "og:title", content: "Demo — Gig Agenda" }, { property: "og:description", content: "Try sending invitations to sample staff." }] }),
  component: Demo,
});

// ── Sample data (practice mode stays in this browser; nothing is sent to real people) ──
type Status = DemoStatus;
type Worker = DemoWorker & { id: string };
interface Invite { id: string; workerId: string; day: string; eventTitle: string; position: string; start: string; end: string; status: "waiting" | "accepted" | "declined"; reason?: string | undefined; sentAt: string; repliedAt?: string | undefined }
interface Note { id: string; text: string; at: string; read: boolean }
const WORKERS: Worker[] = DEMO_WORKERS.map((w) => ({ ...w, id: w.slug }));
const POSITIONS = [...new Set(WORKERS.map((w) => w.position))];

const KEY = "gig-agenda:demo";
interface DemoState { invites: Invite[]; notes: Note[] }
const load = (): DemoState => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "") as DemoState;
  } catch {
    return { invites: [], notes: [] };
  }
};

const availLabel = (a: ReturnType<typeof demoAvail>) =>
  a.status === "available" ? "Available" : a.status === "partial" ? `${a.from}–${a.to}` : a.status === "unavailable" ? "Unavailable" : "No answer";
const availCls = (s: Status) =>
  s === "available" ? "bg-success/25" : s === "partial" ? "bg-warning/35" : s === "unavailable" ? "bg-destructive/15" : "bg-card";

function Demo() {
  const today = hkToday();
  const [state, setState] = useState<DemoState>({ invites: [], notes: [] });
  useEffect(() => setState(load()), []);
  const save = (next: DemoState) => {
    setState(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  };

  // Real Puree events cached by the calendar, to pick from.
  const horizon = addDays(today, 27);
  const { data: events = [] } = useQuery({
    queryKey: ["demo-events", today, horizon],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id,day,title,client_name,start_time,state,account,reference").gte("day", today).lte("day", horizon).order("day");
      return (data ?? []).filter((e) => !["declined", "expired"].includes(String(e.state ?? "").toLowerCase()));
    },
  });

  // ── Send form ──
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i));
  const [picked, setPicked] = useState<string[]>([]);
  const [eventFor, setEventFor] = useState<Record<string, string>>({});
  const [position, setPosition] = useState("Server");
  const [start, setStart] = useState("17:30");
  const [end, setEnd] = useState("22:30");
  const [chosen, setChosen] = useState<string[]>([]);
  const eligible = WORKERS.filter((w) => w.position === position);
  const fits = (w: Worker, d: string) => {
    const a = demoAvail(w.id, d);
    if (a.status === "available") return true;
    if (a.status === "partial") return (a.from ?? "") <= start && (a.to ?? "") >= end;
    return false;
  };

  const send = () => {
    if (!picked.length || !chosen.length) return toast.error("Pick at least one date and one person");
    const now = new Date().toISOString();
    const invites: Invite[] = [];
    for (const d of picked)
      for (const wid of chosen) {
        const ev = events.find((e) => e.id === eventFor[d]);
        invites.push({ id: crypto.randomUUID(), workerId: wid, day: d, eventTitle: ev ? `${ev.account === "gingers" ? "G" : "R"} #${ev.reference ?? ""} ${ev.client_name ?? ev.title}` : "Event", position, start, end, status: "waiting", sentAt: now });
      }
    save({ ...state, invites: [...invites, ...state.invites] });
    toast.success(`${invites.length} invitation${invites.length === 1 ? "" : "s"} sent (demo)`);
    setChosen([]);
  };

  // ── Replies ──
  const reply = (id: string, status: "accepted" | "declined", reason?: string) => {
    const inv = state.invites.find((i) => i.id === id);
    if (!inv) return;
    const w = WORKERS.find((x) => x.id === inv.workerId)!;
    const note: Note = { id: crypto.randomUUID(), at: new Date().toISOString(), read: false, text: `${w.name} ${status} ${inv.position} on ${fmtDay(inv.day)} (${inv.eventTitle})${reason ? ` – ${reason}` : ""}` };
    save({
      invites: state.invites.map((i) => (i.id === id ? { ...i, status, reason, repliedAt: note.at } : i)),
      notes: [note, ...state.notes],
    });
  };
  const simulate = () => {
    const waiting = state.invites.filter((i) => i.status === "waiting");
    if (!waiting.length) return toast("No invitations waiting");
    const now = new Date().toISOString();
    const notes: Note[] = [];
    const invites = state.invites.map((i) => {
      if (i.status !== "waiting") return i;
      const w = WORKERS.find((x) => x.id === i.workerId)!;
      const ok = fits(w, i.day) && Math.random() > 0.25;
      const status: Invite["status"] = ok ? "accepted" : "declined";
      notes.push({ id: crypto.randomUUID(), at: now, read: false, text: `${w.name} ${status} ${i.position} on ${fmtDay(i.day)} (${i.eventTitle})` });
      return { ...i, status, repliedAt: now, reason: ok ? undefined : "Not available" };
    });
    save({ invites, notes: [...notes, ...state.notes] });
  };

  const [phoneOf, setPhoneOf] = useState(WORKERS[0]!.id);
  const unread = state.notes.filter((n) => !n.read).length;

  // ── Availability board ──
  const [who, setWho] = useState("all");
  const [boardPos, setBoardPos] = useState("all");
  const boardDays = days.slice(0, 14);
  const boardPeople = WORKERS.filter((w) => (who === "all" || w.id === who) && (boardPos === "all" || w.position === boardPos));

  const statusBadge = (s: Invite["status"]) => (
    <Badge variant="outline" className={cn(s === "accepted" && "border-success text-success", s === "declined" && "border-destructive text-destructive")}>
      {s === "waiting" ? "Waiting" : s === "accepted" ? "Accepted" : "Declined"}
    </Badge>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex items-center gap-2 text-3xl font-bold"><Sparkles className="h-6 w-6 text-primary" />Demo</h1>
        <Button variant="outline" size="sm" onClick={() => { save({ invites: [], notes: [] }); toast("Demo reset"); }} className="gap-1.5"><RotateCcw className="h-4 w-4" />Reset demo</Button>
      </div>
      <DemoInApp />
      <p className="rounded-lg border border-dashed bg-secondary/40 p-3 text-sm text-muted-foreground">
        Practice area with 10 sample workers. Invitations here stay in this browser and are never sent to real people. The events come from your Puree calendar. For real call-outs, open an event on the <Link to="/home" className="underline">Events</Link> page and use Call staff.
      </p>

      <Tabs defaultValue="send">
        <TabsList className="flex-wrap">
          <TabsTrigger value="send">Send invitations</TabsTrigger>
          <TabsTrigger value="replies">Replies {state.invites.length ? `(${state.invites.length})` : ""}</TabsTrigger>
          <TabsTrigger value="phone">Worker's phone</TabsTrigger>
          <TabsTrigger value="board">Availability</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1"><Bell className="h-3.5 w-3.5" />Office notifications {unread ? <Badge className="ml-1 h-5 px-1.5">{unread}</Badge> : null}</TabsTrigger>
        </TabsList>

        {/* Send */}
        <TabsContent value="send" className="space-y-4">
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">1. Dates</h2>
            <div className="flex flex-wrap gap-1.5">
              {days.map((d) => {
                const n = events.filter((e) => e.day === d).length;
                const on = picked.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== d) : [...p, d].sort()))}
                    className={cn("min-w-16 rounded-lg border px-2 py-1 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary")}
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
                  <Select value={eventFor[d] ?? "none"} onValueChange={(v) => setEventFor((m) => ({ ...m, [d]: v }))}>
                    <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{list.length ? "Choose the Puree event…" : "No Puree event this day"}</SelectItem>
                      {list.map((e) => <SelectItem key={e.id} value={e.id}>{e.account === "gingers" ? "G" : "R"} #{e.reference} · {e.client_name ?? e.title}{e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </section>

          <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
            <h2 className="w-full font-semibold">2. Position and hours</h2>
            <div className="space-y-1"><Label>Position</Label>
              <Select value={position} onValueChange={(v) => { setPosition(v); setChosen([]); }}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>From</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" /></div>
            <div className="space-y-1"><Label>To</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-32" /></div>
            <span className="pb-2 text-sm text-muted-foreground">{shiftHours(start, end).toFixed(1)} h</span>
          </section>

          <section className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-semibold">3. Who to invite</h2>
              <Button variant="ghost" size="sm" onClick={() => setChosen(eligible.filter((w) => picked.every((d) => fits(w, d))).map((w) => w.id))}>Select everyone available</Button>
            </div>
            {!picked.length && <p className="text-sm text-muted-foreground">Pick dates first to see who is available.</p>}
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2" /><th className="p-2">Name</th><th className="p-2">Rate</th>{picked.map((d) => <th key={d} className="p-2">{fmtDay(d)}</th>)}</tr></thead>
                <tbody>
                  {eligible.map((w) => {
                    const ok = picked.length > 0 && picked.every((d) => fits(w, d));
                    return (
                      <tr key={w.id} className={cn("border-t", !ok && picked.length > 0 && "text-muted-foreground")}>
                        <td className="p-2"><Checkbox checked={chosen.includes(w.id)} onCheckedChange={(c) => setChosen((x) => (c ? [...x, w.id] : x.filter((y) => y !== w.id)))} aria-label={`Invite ${w.name}`} /></td>
                        <td className="p-2 font-medium">{w.name}</td>
                        <td className="p-2 tabular-nums">HK${w.rate}/h</td>
                        {picked.map((d) => { const a = demoAvail(w.id, d); return <td key={d} className={cn("p-2 text-xs", availCls(a.status))}>{availLabel(a)}</td>; })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button onClick={send} disabled={!picked.length || !chosen.length} className="gap-1.5">
              <Send className="h-4 w-4" />Send {chosen.length * picked.length || ""} invitation{chosen.length * picked.length === 1 ? "" : "s"}
            </Button>
          </section>
        </TabsContent>

        {/* Replies */}
        <TabsContent value="replies" className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">Waiting {state.invites.filter((i) => i.status === "waiting").length}</Badge>
            <Badge variant="outline" className="border-success text-success">Accepted {state.invites.filter((i) => i.status === "accepted").length}</Badge>
            <Badge variant="outline" className="border-destructive text-destructive">Declined {state.invites.filter((i) => i.status === "declined").length}</Badge>
            <Button size="sm" variant="outline" className="ml-auto" onClick={simulate}>Simulate replies</Button>
          </div>
          {!state.invites.length ? (
            <p className="text-sm text-muted-foreground">No invitations yet. Send some from the first tab.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs"><tr><th className="p-2">Date</th><th className="p-2">Event</th><th className="p-2">Position</th><th className="p-2">Hours</th><th className="p-2">Worker</th><th className="p-2">Cost</th><th className="p-2">Status</th></tr></thead>
                <tbody>
                  {[...state.invites].sort((a, b) => a.day.localeCompare(b.day)).map((i) => {
                    const w = WORKERS.find((x) => x.id === i.workerId)!;
                    const h = shiftHours(i.start, i.end);
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="p-2">{fmtDay(i.day)}</td><td className="p-2">{i.eventTitle}</td><td className="p-2">{i.position}</td>
                        <td className="p-2">{i.start}–{i.end}</td><td className="p-2">{w.name}</td><td className="p-2 tabular-nums">HK${(h * w.rate).toFixed(0)}</td>
                        <td className="p-2">{statusBadge(i.status)}{i.reason ? <span className="ml-1 text-xs text-muted-foreground">{i.reason}</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Worker phone */}
        <TabsContent value="phone" className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span>See the app as</span>
            <Select value={phoneOf} onValueChange={setPhoneOf}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{WORKERS.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · {w.position}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="mx-auto max-w-sm space-y-2 rounded-[2rem] border-8 border-foreground/80 bg-background p-4 shadow-lg">
            <div className="flex items-center justify-between text-sm font-semibold"><span>Gig Agenda</span><Bell className="h-4 w-4" /></div>
            {state.invites.filter((i) => i.workerId === phoneOf).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No invitations for this worker.</p>}
            {state.invites.filter((i) => i.workerId === phoneOf).sort((a, b) => a.day.localeCompare(b.day)).map((i) => {
              const w = WORKERS.find((x) => x.id === i.workerId)!;
              return (
                <div key={i.id} className="space-y-2 rounded-xl border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between"><span className="font-semibold">{fmtDay(i.day)}</span>{statusBadge(i.status)}</div>
                  <div>{i.eventTitle}</div>
                  <div className="text-muted-foreground">{i.position} · {i.start}–{i.end} · HK${(shiftHours(i.start, i.end) * w.rate).toFixed(0)}</div>
                  {i.status === "waiting" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1" onClick={() => reply(i.id, "accepted")}><Check className="h-4 w-4" />Accept</Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => reply(i.id, "declined", "Can't make it")}><X className="h-4 w-4" />Decline</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Availability */}
        <TabsContent value="board" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="w-48" aria-label="Worker"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workers</SelectItem>
                {WORKERS.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={boardPos} onValueChange={setBoardPos}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All positions</SelectItem>
                {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="text-xs">
              <thead><tr className="bg-secondary"><th className="sticky left-0 min-w-40 bg-secondary p-2 text-left">Worker</th>{boardDays.map((d) => <th key={d} className="min-w-14 p-1 text-center font-medium"><div>{parseDay(d).toLocaleDateString("en-GB", { weekday: "narrow" })}</div><div>{parseDay(d).getDate()}</div></th>)}</tr></thead>
              <tbody>
                {boardPeople.map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="sticky left-0 bg-card p-2"><div className="font-medium">{w.name}</div><div className="text-muted-foreground">{w.position}</div></td>
                    {boardDays.map((d) => { const a = demoAvail(w.id, d); return <td key={d} className={cn("border-l p-0.5 text-center", availCls(a.status))} title={availLabel(a)}>{a.status === "partial" ? <span className="text-[9px] leading-none">{a.from}<br />{a.to}</span> : a.status === "available" ? "✓" : a.status === "unavailable" ? "✕" : ""}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Office notifications */}
        <TabsContent value="notes" className="space-y-2">
          {unread > 0 && <Button size="sm" variant="ghost" onClick={() => save({ ...state, notes: state.notes.map((n) => ({ ...n, read: true })) })}>Mark all read</Button>}
          {!state.notes.length && <p className="text-sm text-muted-foreground">Replies from workers appear here.</p>}
          {state.notes.map((n) => (
            <div key={n.id} className={cn("rounded-lg border bg-card p-3 text-sm", !n.read && "border-primary")}>
              <div>{n.text}</div>
              <div className="text-xs text-muted-foreground">{new Date(n.at).toLocaleString("en-GB")}</div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Put the sample workers into the real app (staff list, calendar events, availability, reports, rates). */
function DemoInApp() {
  const qc = useQueryClient();
  const status = useServerFn(demoStatus);
  const seed = useServerFn(seedDemo);
  const remove = useServerFn(removeDemo);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ["demo-status"], queryFn: () => status() });
  const on = (data?.workers ?? 0) > 0;
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
      <div className="mr-auto min-w-0">
        <div className="font-semibold">Demo workers in the whole app</div>
        <div className="text-muted-foreground">
          {on
            ? `${data?.workers} demo workers are in Staff, Availability, Reports and Rates, with "DEMO ·" events on the calendar.`
            : "Add the 10 sample workers to Staff, Availability, Reports and Rates, plus a few \"DEMO ·\" events on the calendar with their names."}
        </div>
      </div>
      {on && <Button variant="outline" disabled={busy} onClick={() => run(() => remove(), "Demo workers and events removed")}>Remove demo data</Button>}
      <Button disabled={busy} onClick={() => run(() => seed(), on ? "Demo data refreshed" : "Demo workers added")}>{busy ? "Working…" : on ? "Refresh demo data" : "Add demo workers to the app"}</Button>
    </div>
  );
}
