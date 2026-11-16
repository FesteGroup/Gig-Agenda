import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePositions } from "@/lib/me";
import { availClass, resolveAvail } from "@/lib/availability";
import { addDays, hhmm, hkToday, parseDay } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({ meta: [{ title: "Availability board — Gig Agenda" }, { name: "description", content: "Who can work when." }, { property: "og:title", content: "Availability board — Gig Agenda" }, { property: "og:description", content: "Who can work when." }] }),
  component: Board,
});

function Board() {
  const today = hkToday();
  const [span, setSpan] = useState<"7" | "14" | "31">("14");
  const [start, setStart] = useState(addDays(today, -((parseDay(today).getDay() + 6) % 7)));
  const [pos, setPos] = useState("all");
  const [who, setWho] = useState("all");
  const { data: positions = [] } = usePositions();
  const n = Number(span);
  const days = Array.from({ length: n }, (_, i) => addDays(start, i));
  const end = days[days.length - 1];

  const { data } = useQuery({
    queryKey: ["board", start, end],
    queryFn: async () => {
      const [p, a, pt] = await Promise.all([
        supabase.from("profiles").select("id,full_name,main_position_id,other_position_ids").eq("active", true).order("full_name"),
        supabase.from("availability").select("*").gte("day", start).lte("day", end),
        supabase.from("availability_patterns").select("*"),
      ]);
      return { people: p.data ?? [], avail: a.data ?? [], patterns: pt.data ?? [] };
    },
  });

  const people = (data?.people ?? []).filter(
    (p) => (who === "all" || p.id === who) && (pos === "all" || p.main_position_id === pos || p.other_position_ids.includes(pos)),
  );
  const selected = who === "all" ? null : (data?.people ?? []).find((p) => p.id === who) ?? null;
  const cell = (uid: string, day: string) => resolveAvail(day, data?.avail.find((a) => a.user_id === uid && a.day === day), data?.patterns.filter((x) => x.user_id === uid));
  const posName = (id: string | null) => positions.find((p) => p.id === id)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">Availability</h1>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="w-48" aria-label="Staff member"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {(data?.people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All positions</SelectItem>
            {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToggleGroup type="single" value={span} onValueChange={(v) => v && setSpan(v as typeof span)} variant="outline" size="sm">
          <ToggleGroupItem value="7">Week</ToggleGroupItem>
          <ToggleGroupItem value="14">2 weeks</ToggleGroupItem>
          <ToggleGroupItem value="31">Month</ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="icon" onClick={() => setStart(addDays(start, -n))} aria-label="Previous"><ChevronLeft /></Button>
        <Button variant="ghost" size="icon" onClick={() => setStart(addDays(start, n))} aria-label="Next"><ChevronRight /></Button>
      </div>
      {selected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
          <span className="font-semibold">{selected.full_name}</span>
          <span className="text-muted-foreground">{posName(selected.main_position_id)}</span>
          <span>Available {days.filter((d) => cell(selected.id, d)?.status === "available").length} days</span>
          <span>Partly {days.filter((d) => cell(selected.id, d)?.status === "partial").length}</span>
          <span>Unavailable {days.filter((d) => cell(selected.id, d)?.status === "unavailable").length}</span>
          <span className="text-muted-foreground">Not answered {days.filter((d) => !cell(selected.id, d)).length}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setWho("all")}>Show everyone</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="text-xs">
          <thead>
            <tr className="bg-secondary">
              <th className="sticky left-0 z-10 min-w-40 bg-secondary p-2 text-left">Staff</th>
              {days.map((d) => (
                <th key={d} className={cn("min-w-11 p-1 text-center font-medium", d === today && "text-primary")}>
                  <div>{parseDay(d).toLocaleDateString("en-GB", { weekday: "narrow" })}</div>
                  <div>{parseDay(d).getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="sticky left-0 z-10 bg-card p-2">
                  <Link to="/staff/$id" params={{ id: p.id }} className="font-medium hover:underline">{p.full_name}</Link>
                  <div className="text-muted-foreground">{posName(p.main_position_id)}</div>
                </td>
                {days.map((d) => {
                  const a = cell(p.id, d);
                  return (
                    <td key={d} className={cn("border-l p-0.5 text-center", availClass(a))} title={a?.status}>
                      {a?.status === "partial" ? <span className="text-[9px] leading-none">{hhmm(a.start_time)}<br />{hhmm(a.end_time)}</span> : a?.status === "available" ? "✓" : a ? "✕" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 bg-secondary/60 font-semibold">
              <td className="sticky left-0 z-10 bg-secondary p-2">Available</td>
              {days.map((d) => <td key={d} className="p-1 text-center">{people.filter((p) => { const a = cell(p.id, d); return a && a.status !== "unavailable"; }).length}</td>)}
            </tr>
            {pos === "all" && !selected && positions.map((ps) => (
              <tr key={ps.id} className="border-t text-muted-foreground">
                <td className="sticky left-0 z-10 bg-card p-2 pl-4">{ps.name}</td>
                {days.map((d) => (
                  <td key={d} className="p-1 text-center">
                    {people.filter((p) => (p.main_position_id === ps.id || p.other_position_ids.includes(ps.id)) && (() => { const a = cell(p.id, d); return a && a.status !== "unavailable"; })()).length || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
