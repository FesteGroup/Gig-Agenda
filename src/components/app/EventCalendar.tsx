import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { syncPuree } from "@/lib/puree.functions";
import { addDays, fmtDay, hhmm, hkToday, parseDay, toDay } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { ManualEventDialog } from "./ManualEventDialog";
import type { Tables } from "@/integrations/supabase/types";

type View = "month" | "week" | "day";
type Ev = Tables<"events"> & { slots_needed: number; slots_filled: number };

const ACTIVE = ["accepted", "confirmed", "live", "processing"];

function rangeFor(view: View, anchor: string) {
  const d = parseDay(anchor);
  if (view === "day") return { from: anchor, to: anchor };
  if (view === "week") {
    const dow = (d.getDay() + 6) % 7;
    const from = addDays(anchor, -dow);
    return { from, to: addDays(from, 6) };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dow = (first.getDay() + 6) % 7;
  const from = addDays(toDay(first), -dow);
  return { from, to: addDays(from, 41) };
}

export function EventCalendar() {
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(hkToday());
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const { from, to } = rangeFor(view, anchor);
  const qc = useQueryClient();
  const sync = useServerFn(syncPuree);

  const { data: events = [] } = useQuery({
    queryKey: ["events", from, to],
    queryFn: async (): Promise<Ev[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*, staffing_rows(quantity, invitations(status))")
        .gte("day", from)
        .lte("day", to)
        .order("day")
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map((e) => {
        const rows = (e.staffing_rows ?? []) as { quantity: number; invitations: { status: string }[] }[];
        return {
          ...e,
          slots_needed: rows.reduce((s, r) => s + r.quantity, 0),
          slots_filled: rows.reduce((s, r) => s + r.invitations.filter((i) => i.status === "accepted" || i.status === "confirmed").length, 0),
        } as Ev;
      });
    },
  });

  async function refresh(quiet = false) {
    setSyncing(true);
    try {
      const r = await sync({ data: { from, to } });
      if (!quiet) toast.success(r.fromCopy ? `Updated from the Calendar app's Puree copy of ${r.fromCopy} (${r.synced} orders)` : `Updated from Puree (${r.synced} orders)`);
      r.warnings.forEach((w) => !quiet && toast.warning(w));
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch (e) {
      if (!quiet) toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(true), 5 * 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const visible = useMemo(
    () =>
      events.filter((e) => {
        const s = (e.state ?? "").toLowerCase();
        if (s === "declined" || s === "expired") return false;
        if (e.source === "manual") return true;
        return ACTIVE.includes(s) || pending;
      }),
    [events, pending],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, Ev[]>();
    visible.forEach((e) => m.set(e.day, [...(m.get(e.day) ?? []), e]));
    return m;
  }, [visible]);

  function step(dir: number) {
    const d = parseDay(anchor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
    setAnchor(toDay(d));
  }

  const title =
    view === "month"
      ? parseDay(anchor).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : view === "week"
        ? `${fmtDay(from, { day: "numeric", month: "short" })} – ${fmtDay(to, { day: "numeric", month: "short" })}`
        : fmtDay(anchor, { weekday: "long", day: "numeric", month: "long" });

  const today = hkToday();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold sm:text-3xl">{title}</h1>
        <div className="flex items-center gap-2">
          <Switch id="pending" checked={pending} onCheckedChange={setPending} />
          <Label htmlFor="pending" className="text-sm">Quotes</Label>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={syncing}>
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} /> Refresh
        </Button>
        <Button size="sm" onClick={() => setManualOpen(true)}>
          <Plus className="h-4 w-4" /> Event
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></Button>
        <Button variant="outline" size="sm" onClick={() => setAnchor(today)}>Today</Button>
        <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next"><ChevronRight /></Button>
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as View)} variant="outline" size="sm" className="ml-auto">
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "month" ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-gradient-to-r from-primary/15 via-sky/15 to-violet/15 text-center text-xs font-semibold text-foreground/70">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => <div key={d} className={cn("py-2", i > 4 && "text-coral")}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((day, i) => {
              const inMonth = parseDay(day).getMonth() === parseDay(anchor).getMonth();
              const list = byDay.get(day) ?? [];
              return (
                <button
                  key={day}
                  onClick={() => { setAnchor(day); setView("day"); }}
                  className={cn("min-h-20 border-b border-r p-1 text-left align-top transition-colors hover:bg-sky/5 sm:min-h-28", i % 7 > 4 && "bg-coral/[0.04]", day === today && "bg-sun/15", !inMonth && "bg-muted/50 text-muted-foreground")}
                >
                  <div className={cn("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", day === today && "bg-coral text-white font-bold shadow")}>
                    {parseDay(day).getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((e) => <MiniChip key={e.id} e={e} />)}
                    {list.length > 3 && <div className="text-[10px] text-muted-foreground">+{list.length - 3} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(from, i)).map((day) => (
            <section key={day}>
              <h2 className={cn("mb-2 text-sm font-semibold font-sans", day === today ? "text-coral" : "text-muted-foreground")}>{fmtDay(day, { weekday: "long", day: "numeric", month: "short" })}</h2>
              <div className="space-y-2">
                {(byDay.get(day) ?? []).map((e) => <EventCard key={e.id} e={e} />)}
                {!(byDay.get(day) ?? []).length && <p className="text-sm text-muted-foreground">No events</p>}
              </div>
            </section>
          ))}
        </div>
      )}
      <ManualEventDialog open={manualOpen} onOpenChange={setManualOpen} defaultDay={anchor} />
    </div>
  );
}

function acct(e: Ev) {
  return e.source === "manual" ? "M" : e.account === "gingers" ? "G" : "R";
}

function isPending(e: Ev) {
  return e.source === "puree" && !ACTIVE.includes((e.state ?? "").toLowerCase());
}

function MiniChip({ e }: { e: Ev }) {
  return (
    <Link
      to="/events/$id"
      params={{ id: e.id }}
      onClick={(ev) => ev.stopPropagation()}
      className={cn(
        "block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight sm:text-[11px]",
        e.source === "manual" ? "bg-violet/15 text-violet" : e.account === "gingers" ? "bg-accent/40 text-accent-foreground" : "bg-primary/15 text-primary",
        isPending(e) && "border border-dashed border-current bg-transparent",
      )}
    >
      <b>{acct(e)}</b> {hhmm(e.start_time)} {e.client_name || e.title}
    </Link>
  );
}

function EventCard({ e }: { e: Ev }) {
  const open = e.slots_needed - e.slots_filled;
  return (
    <Link
      to="/events/$id"
      params={{ id: e.id }}
      className={cn(
        "flex gap-3 rounded-xl border border-l-4 bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        e.source === "manual" ? "border-l-violet" : e.account === "gingers" ? "border-l-accent" : "border-l-primary",
        isPending(e) && "border-dashed border-2",
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold", e.source === "manual" ? "bg-violet text-white" : e.account === "gingers" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground")}>
        {acct(e)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{hhmm(e.start_time) || "—"}</span>
          <span className="truncate font-semibold">{e.title}</span>
          {e.reference && <span className="text-xs text-muted-foreground">#{e.reference}</span>}
          {isPending(e) && <span className="text-xs text-muted-foreground">({e.state})</span>}
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {[e.client_name, e.pax ? `${e.pax} guests` : null, e.venue].filter(Boolean).join(" · ")}
        </div>
      </div>
      {e.slots_needed > 0 && (
        <div className={cn("self-center rounded-full px-2 py-0.5 text-xs font-semibold", open > 0 ? "bg-coral/15 text-coral" : "bg-success/20 text-success")}>
          {e.slots_filled}/{e.slots_needed}
        </div>
      )}
    </Link>
  );
}
