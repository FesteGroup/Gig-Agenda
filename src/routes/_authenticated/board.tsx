import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePositions } from "@/lib/me";
import { availClass, resolveAvail, type DayAvail } from "@/lib/availability";
import { addDays, fmtDay, hhmm, hkToday, parseDay } from "@/lib/time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({ meta: [{ title: "Availability — Gig Agenda" }, { name: "description", content: "Who can work when." }, { property: "og:title", content: "Availability — Gig Agenda" }, { property: "og:description", content: "Who can work when." }] }),
  component: Board,
});

const availLabel = (a: DayAvail | null) =>
  !a ? "No answer" : a.status === "available" ? "Available" : a.status === "partial" ? `${hhmm(a.start_time)}–${hhmm(a.end_time)}` : "Unavailable";

function Board() {
  const today = hkToday();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const end = days[days.length - 1]!;
  const [who, setWho] = useState("all");
  const [pos, setPos] = useState("all");
  const { data: positions = [] } = usePositions();

  const { data } = useQuery({
    queryKey: ["board", today, end],
    queryFn: async () => {
      const [p, a, pt] = await Promise.all([
        supabase.from("profiles").select("id,full_name,main_position_id,other_position_ids").eq("active", true).order("full_name"),
        supabase.from("availability").select("*").gte("day", today).lte("day", end),
        supabase.from("availability_patterns").select("*"),
      ]);
      return { people: p.data ?? [], avail: a.data ?? [], patterns: pt.data ?? [] };
    },
  });

  const all = data?.people ?? [];
  const people = all.filter((p) => (who === "all" || p.id === who) && (pos === "all" || p.main_position_id === pos || p.other_position_ids.includes(pos)));
  const cell = (uid: string, day: string) => resolveAvail(day, data?.avail.find((a) => a.user_id === uid && a.day === day), data?.patterns.filter((x) => x.user_id === uid));
  const posName = (id: string | null) => positions.find((p) => p.id === id)?.name ?? "";
  const missing = people.filter((p) => days.some((d) => !cell(p.id, d)));
  const [asking, setAsking] = useState(false);

  async function ask() {
    if (!missing.length) return toast("Everyone has answered for the next 14 days");
    if (!window.confirm(`Ask ${missing.length} worker${missing.length === 1 ? "" : "s"} to fill in their availability?`)) return;
    setAsking(true);
    const { error } = await supabase.from("notifications").insert(
      missing.map((p) => ({ user_id: p.id, title: "Please update your availability", body: `Let us know when you can work from ${fmtDay(today)} to ${fmtDay(end)}.`, link: "/availability" })),
    );
    setAsking(false);
    if (error) return toast.error(error.message);
    toast.success(`Asked ${missing.length} worker${missing.length === 1 ? "" : "s"}`);
  }

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold">Availability</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="w-48" aria-label="Worker"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workers</SelectItem>
            {all.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All positions</SelectItem>
            {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{missing.length} of {people.length} still to answer</span>
        <Button size="sm" onClick={ask} disabled={asking || !missing.length} className="gap-1.5"><BellRing className="h-4 w-4" />Ask for availability</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="text-xs">
          <thead><tr className="bg-secondary"><th className="sticky left-0 min-w-40 bg-secondary p-2 text-left">Worker</th>{days.map((d) => <th key={d} className="w-14 min-w-14 p-1 text-center font-medium"><div>{parseDay(d).toLocaleDateString("en-GB", { weekday: "narrow" })}</div><div>{parseDay(d).getDate()}</div></th>)}</tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="h-12 border-t">
                <td className="sticky left-0 bg-card p-2"><div className="font-medium">{p.full_name}</div><div className="text-muted-foreground">{posName(p.main_position_id) || posName(p.other_position_ids[0] ?? null) || "\u00a0"}</div></td>
                {days.map((d) => { const a = cell(p.id, d); return <td key={d} className={cn("border-l p-0.5 text-center", availClass(a))} title={availLabel(a)}>{a?.status === "partial" ? <span className="text-[9px] leading-none">{hhmm(a.start_time)}<br />{hhmm(a.end_time)}</span> : a?.status === "available" ? "✓" : a?.status === "unavailable" ? "✕" : ""}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
