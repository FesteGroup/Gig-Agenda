import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { coversShift, overlaps, resolveAvail } from "@/lib/availability";
import { hhmm, parseDay } from "@/lib/time";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type Row = { id: string; position_id: string; quantity: number; start_time: string; end_time: string; positions: { name: string } | null; invitations: { user_id: string; status: string }[] };
type Ev = { id: string; day: string; title: string };

export function CallStaffDialog({ row, ev, onClose, onSent }: { row: Row; ev: Ev; onClose: () => void; onSent: () => void }) {
  const [mode, setMode] = useState<"direct" | "broadcast">("direct");
  const [hours, setHours] = useState("24");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["call-candidates", row.id, ev.day],
    queryFn: async () => {
      const [profiles, avail, patterns, booked] = await Promise.all([
        supabase.from("profiles").select("id,full_name,photo_url,main_position_id,other_position_ids,active").eq("active", true).order("full_name"),
        supabase.from("availability").select("*").eq("day", ev.day),
        supabase.from("availability_patterns").select("*").eq("weekday", parseDay(ev.day).getDay()),
        supabase.from("invitations").select("user_id,status,staffing_rows!inner(start_time,end_time,id),events!inner(day,title)").eq("events.day", ev.day).in("status", ["accepted", "confirmed"]),
      ]);
      return { profiles: profiles.data ?? [], avail: avail.data ?? [], patterns: patterns.data ?? [], booked: booked.data ?? [] };
    },
  });

  const list = useMemo(() => {
    if (!data) return [];
    const already = new Set(row.invitations.filter((i) => !["declined", "cancelled", "closed"].includes(i.status)).map((i) => i.user_id));
    return data.profiles
      .filter((p) => !already.has(p.id))
      .map((p) => {
        const covers = p.main_position_id === row.position_id || (p.other_position_ids ?? []).includes(row.position_id);
        const a = resolveAvail(ev.day, data.avail.find((x) => x.user_id === p.id), data.patterns.filter((x) => x.user_id === p.id));
        const clash = data.booked.find((b) => b.user_id === p.id && b.staffing_rows.id !== row.id && overlaps(b.staffing_rows.start_time, b.staffing_rows.end_time, row.start_time, row.end_time));
        let reason: string | null = null;
        if (!covers) reason = "Not this position";
        else if (clash) reason = `Booked: ${clash.events.title}`;
        else if (!a) reason = "No availability given";
        else if (!coversShift(a, row.start_time, row.end_time)) reason = a.status === "unavailable" ? "Unavailable" : `Available ${hhmm(a.start_time)}–${hhmm(a.end_time)} only`;
        const soft = reason === "No availability given";
        return { ...p, reason, soft, eligible: !reason };
      })
      .sort((x, y) => Number(y.eligible) - Number(x.eligible) || Number(y.soft) - Number(x.soft));
  }, [data, row, ev.day]);

  const eligible = list.filter((p) => p.eligible);

  async function send() {
    const ids = mode === "broadcast" ? eligible.map((p) => p.id) : [...picked];
    if (!ids.length) return toast.error("No one selected");
    setBusy(true);
    const deadline = new Date(Date.now() + Number(hours || 24) * 3600_000).toISOString();
    const { error } = await supabase.from("invitations").upsert(
      ids.map((user_id) => ({ staffing_row_id: row.id, event_id: ev.id, user_id, mode, deadline, status: "invited" as const, decline_reason: null, responded_at: null })),
      { onConflict: "staffing_row_id,user_id" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Invitation sent to ${ids.length} ${ids.length === 1 ? "person" : "people"}`);
    onSent();
  }

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Call staff · {row.positions?.name}</DialogTitle>
          <DialogDescription>{hhmm(row.start_time)}–{hhmm(row.end_time)} · {eligible.length} available</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "direct" | "broadcast")} className="gap-2">
          <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="direct" /> Invite the people I pick</label>
          <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="broadcast" /> First to accept gets it — send to all {eligible.length} available</label>
        </RadioGroup>
        <div className="flex items-center gap-2">
          <Label htmlFor="dl" className="text-sm">Reply within</Label>
          <Input id="dl" type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} className="w-20" />
          <span className="text-sm text-muted-foreground">hours</span>
        </div>
        <div className="divide-y rounded-lg border">
          {list.map((p) => {
            const selectable = mode === "direct" && (p.eligible || p.soft);
            return (
              <label key={p.id} className={cn("flex items-center gap-3 p-2.5 text-sm", !p.eligible && "opacity-50", selectable && "cursor-pointer")}>
                <Checkbox disabled={!selectable} checked={mode === "broadcast" ? p.eligible : picked.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <span className="font-medium">{p.full_name}</span>
                {p.reason && <span className="ml-auto text-xs text-muted-foreground">{p.reason}</span>}
              </label>
            );
          })}
          {list.length === 0 && <p className="p-3 text-sm text-muted-foreground">No staff yet.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={busy}>Send invitations</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
