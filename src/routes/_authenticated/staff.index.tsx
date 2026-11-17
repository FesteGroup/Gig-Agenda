import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hkToday, shiftHours } from "@/lib/time";
import { usePositions } from "@/lib/me";
import { inviteStaff } from "@/lib/staff.functions";
import { importRelishStaff } from "@/lib/import.functions";
import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff/")({
  head: () => ({ meta: [{ title: "Staff — Gig Agenda" }, { name: "description", content: "Staff directory." }, { property: "og:title", content: "Staff — Gig Agenda" }, { property: "og:description", content: "Staff directory." }] }),
  component: Page,
});

function Page() {
  const { data: positions = [] } = usePositions();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const runImport = useServerFn(importRelishStaff);
  const [importing, setImporting] = useState(false);
  async function doImport() {
    if (!confirm("Add the Relish workers, their rates and their past shifts from the servers' payment file? Running it again updates the same records.")) return;
    setImporting(true);
    try {
      const r = await runImport();
      toast.success(`${r.workers} workers, ${r.events} events and ${r.shifts} shifts imported`);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }
  const { data = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("*").order("full_name"), supabase.from("user_roles").select("user_id,role").eq("role", "office")]);
      const office = new Set((r.data ?? []).map((x) => x.user_id));
      return (p.data ?? []).map((x) => ({ ...x, isOffice: office.has(x.id) }));
    },
  });
  const today = hkToday();
  const [period, setPeriod] = useState<"month" | "last" | "year" | "all">("all");
  const [sort, setSort] = useState<"name" | "hours">("name");
  const from = (() => {
    const [y = 2026, m = 1] = today.split("-").map(Number);
    if (period === "month") return `${today.slice(0, 7)}-01`;
    if (period === "last") return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    if (period === "year") return `${y}-01-01`;
    return "2000-01-01";
  })();
  const to = (() => {
    if (period !== "last") return today;
    const [y = 2026, m = 1] = today.split("-").map(Number);
    const d = new Date(y, m - 1, 0); // last day of previous month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const { data: hoursBy = {} } = useQuery({
    queryKey: ["staff-hours", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("user_id, events!inner(day), staffing_rows(start_time,end_time,break_minutes)")
        .in("status", ["accepted", "confirmed"])
        .gte("events.day", from)
        .lte("events.day", to);
      if (error) throw error;
      const out: Record<string, { hours: number; gigs: number }> = {};
      for (const i of data ?? []) {
        const r = i.staffing_rows;
        if (!r) continue;
        const o = (out[i.user_id] ??= { hours: 0, gigs: 0 });
        o.hours += shiftHours(r.start_time, r.end_time, r.break_minutes);
        o.gigs += 1;
      }
      return out;
    },
  });
  const totalHours = Object.values(hoursBy).reduce((s, x) => s + x.hours, 0);
  const fmtH = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1));
  const pos = (id: string | null) => positions.find((p) => p.id === id)?.name;
  const list = data
    .filter((p) => !q || (p.full_name + " " + (p.email ?? "") + " " + (p.phone ?? "")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "hours" ? (hoursBy[b.id]?.hours ?? 0) - (hoursBy[a.id]?.hours ?? 0) : 0) || a.full_name.localeCompare(b.full_name));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">Staff</h1>
        <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
        <Button variant="outline" onClick={doImport} disabled={importing}>{importing ? "Importing…" : "Import Relish servers"}</Button>
        <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add staff</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
        <span className="font-medium">Hours worked</span>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-36" aria-label="Period"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="last">Last month</SelectItem>
            <SelectItem value="year">This year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-40" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by name</SelectItem>
            <SelectItem value="hours">Most hours first</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-muted-foreground">Team total <span className="font-semibold tabular-nums text-foreground">{fmtH(totalHours)} h</span></span>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {list.map((p) => (
          <Link key={p.id} to="/staff/$id" params={{ id: p.id }} className={cn("flex items-center gap-3 p-3 hover:bg-secondary", !p.active && "opacity-50")}>
            <Avatar name={p.full_name} url={p.photo_url} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.full_name} {p.isOffice && <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">Office</span>}</div>
              <div className="truncate text-sm text-muted-foreground">{[pos(p.main_position_id), ...p.other_position_ids.map(pos)].filter(Boolean).join(", ") || "No position"}</div>
            </div>
            <div className="hidden text-right text-sm text-muted-foreground sm:block">{p.phone}<br />{p.email}</div>
            <div className="w-20 shrink-0 text-right">
              <div className="text-lg font-semibold tabular-nums">{fmtH(hoursBy[p.id]?.hours ?? 0)} h</div>
              <div className="text-xs text-muted-foreground">{hoursBy[p.id]?.gigs ?? 0} gig{(hoursBy[p.id]?.gigs ?? 0) === 1 ? "" : "s"}</div>
            </div>
          </Link>
        ))}
      </div>
      <InviteDialog open={open} onOpenChange={setOpen} positions={positions} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, positions }: { open: boolean; onOpenChange: (o: boolean) => void; positions: { id: string; name: string }[] }) {
  const invite = useServerFn(inviteStaff);
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", email: "", phone: "", main_position_id: "" });
  const [busy, setBusy] = useState(false);
  const signupMsg = `Hi ${f.full_name.split(" ")[0] || ""}! Please create your Gig Agenda account to get gig call-outs: ${typeof window !== "undefined" ? window.location.origin : ""}/auth`;
  const phoneDigits = f.phone.replace(/\D/g, "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await invite({ data: { email: f.email, full_name: f.full_name, phone: f.phone || undefined, main_position_id: f.main_position_id || undefined, redirectTo: window.location.origin } });
      toast.success(`Invitation email sent to ${f.email}`);
      qc.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
      setF({ full_name: "", email: "", phone: "", main_position_id: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
          <DialogDescription>They get an email to set a password. No email? Send them the sign-up link on WhatsApp.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></div>
          <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Phone (WhatsApp)</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="9123 4567" /></div>
          <div className="grid gap-1.5">
            <Label>Main position</Label>
            <Select value={f.main_position_id} onValueChange={(v) => setF({ ...f, main_position_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            {phoneDigits && (
              <Button type="button" variant="outline" asChild>
                <a href={`https://wa.me/${phoneDigits.length === 8 ? "852" + phoneDigits : phoneDigits}?text=${encodeURIComponent(signupMsg)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Send link on WhatsApp</a>
              </Button>
            )}
            <Button type="submit" disabled={busy || !f.email}>Send email invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
