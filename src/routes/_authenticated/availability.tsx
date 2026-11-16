import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { resolveAvail, type DayAvail } from "@/lib/availability";
import { addDays, fmtDay, hhmm, hkToday, parseDay, toDay } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({ meta: [{ title: "My availability — Gig Agenda" }, { name: "description", content: "Tell the office when you can work." }, { property: "og:title", content: "My availability — Gig Agenda" }, { property: "og:description", content: "Tell the office when you can work." }] }),
  component: Page,
});

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Status = DayAvail["status"] | "clear";

export function availClass(a: DayAvail | null) {
  if (!a) return "bg-card";
  if (a.status === "available") return "bg-success/25";
  if (a.status === "partial") return "bg-warning/35";
  return "bg-destructive/15";
}

function Page() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [month, setMonth] = useState(hkToday().slice(0, 7) + "-01");
  const [editDay, setEditDay] = useState<string | null>(null);
  const [editWd, setEditWd] = useState<number | null>(null);

  const first = parseDay(month);
  const from = addDays(month, -((first.getDay() + 6) % 7));
  const to = addDays(from, 41);

  const { data } = useQuery({
    queryKey: ["my-avail", me?.id, from],
    enabled: !!me,
    queryFn: async () => {
      const [a, p] = await Promise.all([
        supabase.from("availability").select("*").eq("user_id", me!.id).gte("day", addDays(from, -7)).lte("day", to),
        supabase.from("availability_patterns").select("*").eq("user_id", me!.id),
      ]);
      return { days: a.data ?? [], patterns: p.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-avail"] });

  async function saveDays(days: string[], status: Status, start?: string, end?: string) {
    if (!me) return;
    if (status === "clear") {
      await supabase.from("availability").delete().eq("user_id", me.id).in("day", days);
    } else {
      const { error } = await supabase.from("availability").upsert(
        days.map((day) => ({ user_id: me.id, day, status, start_time: status === "partial" ? start! : null, end_time: status === "partial" ? end! : null })),
        { onConflict: "user_id,day" },
      );
      if (error) return toast.error(error.message);
    }
    refresh();
  }

  async function savePattern(weekday: number, status: Status, start?: string, end?: string) {
    if (!me) return;
    if (status === "clear") await supabase.from("availability_patterns").delete().eq("user_id", me.id).eq("weekday", weekday);
    else await supabase.from("availability_patterns").upsert({ user_id: me.id, weekday, status, start_time: status === "partial" ? start! : null, end_time: status === "partial" ? end! : null }, { onConflict: "user_id,weekday" });
    refresh();
  }

  const today = hkToday();
  const nextMon = addDays(today, 7 - ((parseDay(today).getDay() + 6) % 7));
  const thisMon = addDays(nextMon, -7);
  const week = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

  async function copyLastWeek() {
    if (!me) return;
    const { data: last } = await supabase.from("availability").select("*").eq("user_id", me.id).gte("day", addDays(thisMon, -7)).lt("day", thisMon);
    if (!last?.length) return toast.info("Nothing set last week");
    await supabase.from("availability").upsert(last.map((l) => ({ user_id: me.id, day: addDays(l.day, 7), status: l.status, start_time: l.start_time, end_time: l.end_time })), { onConflict: "user_id,day" });
    toast.success("Copied last week to this week");
    refresh();
  }

  const get = (day: string) => resolveAvail(day, data?.days.find((d) => d.day === day), data?.patterns ?? []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">My availability</h1>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => saveDays(week(nextMon), "available").then(() => toast.success("Available all next week"))}>Available all next week</Button>
        <Button variant="outline" size="sm" onClick={copyLastWeek}>Copy last week</Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => { const d = parseDay(month); d.setMonth(d.getMonth() - 1); setMonth(toDay(d)); }} aria-label="Previous month"><ChevronLeft /></Button>
        <h2 className="flex-1 text-center text-xl font-bold">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
        <Button variant="ghost" size="icon" onClick={() => { const d = parseDay(month); d.setMonth(d.getMonth() + 1); setMonth(toDay(d)); }} aria-label="Next month"><ChevronRight /></Button>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 bg-secondary text-center text-xs font-semibold text-muted-foreground">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="py-1.5">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((day) => {
            const a = get(day);
            const inMonth = parseDay(day).getMonth() === first.getMonth();
            return (
              <button key={day} disabled={day < today} onClick={() => setEditDay(day)} className={cn("h-16 border-b border-r p-1 text-left text-xs disabled:opacity-40", availClass(a), !inMonth && "opacity-50")}>
                <div className={cn("font-semibold", day === today && "text-primary")}>{parseDay(day).getDate()}</div>
                {a?.status === "partial" && <div className="text-[10px] leading-tight">{hhmm(a.start_time)}–{hhmm(a.end_time)}</div>}
                {a?.status === "unavailable" && <div className="text-[10px]">✕</div>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-success/25" /> Available</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-warning/35" /> From–to</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-destructive/15" /> Unavailable</span>
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Every week</h2>
        <p className="text-sm text-muted-foreground">Repeating pattern, e.g. “unavailable every Monday”. Specific days above override it.</p>
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const p = data?.patterns.find((x) => x.weekday === wd) ?? null;
            return (
              <button key={wd} onClick={() => setEditWd(wd)} className={cn("rounded-lg border p-2 text-center text-xs", availClass(p))}>
                <div className="font-semibold">{WD[wd]}</div>
                <div className="text-[10px]">{p ? (p.status === "partial" ? `${hhmm(p.start_time)}–${hhmm(p.end_time)}` : p.status === "available" ? "Yes" : "No") : "—"}</div>
              </button>
            );
          })}
        </div>
      </section>

      <AvailEditor
        open={!!editDay}
        title={editDay ? fmtDay(editDay, { weekday: "long", day: "numeric", month: "long" }) : ""}
        initial={editDay ? get(editDay) : null}
        onClose={() => setEditDay(null)}
        onSave={(s, a, b) => { saveDays([editDay!], s, a, b); setEditDay(null); }}
      />
      <AvailEditor
        open={editWd != null}
        title={editWd != null ? `Every ${WD[editWd]}` : ""}
        initial={editWd != null ? data?.patterns.find((x) => x.weekday === editWd) ?? null : null}
        onClose={() => setEditWd(null)}
        onSave={(s, a, b) => { savePattern(editWd!, s, a, b); setEditWd(null); }}
      />
    </div>
  );
}

function AvailEditor({ open, title, initial, onClose, onSave }: { open: boolean; title: string; initial: DayAvail | null; onClose: () => void; onSave: (s: Status, a?: string, b?: string) => void }) {
  const [status, setStatus] = useState<Status>(initial?.status ?? "available");
  const [start, setStart] = useState(hhmm(initial?.start_time) || "17:00");
  const [end, setEnd] = useState(hhmm(initial?.end_time) || "23:00");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} key={title}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <ToggleGroup type="single" value={status} onValueChange={(v) => v && setStatus(v as Status)} variant="outline" className="grid grid-cols-2 gap-2">
          <ToggleGroupItem value="available">Available</ToggleGroupItem>
          <ToggleGroupItem value="partial">From–to</ToggleGroupItem>
          <ToggleGroupItem value="unavailable">Unavailable</ToggleGroupItem>
          <ToggleGroupItem value="clear">Clear</ToggleGroupItem>
        </ToggleGroup>
        {status === "partial" && (
          <div className="flex items-center gap-2">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /> to <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
        <DialogFooter><Button onClick={() => onSave(status, start, end)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
