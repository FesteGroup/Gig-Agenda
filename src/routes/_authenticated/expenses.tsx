import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Download, FileText, Receipt, X, Banknote, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { useMyInvitations } from "@/lib/my-gigs";
import { fmtDay, hkToday, hkdExact as hkd } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Gig Agenda" }, { name: "description", content: "Send expenses such as taxis to the office." }, { property: "og:title", content: "Expenses — Gig Agenda" }, { property: "og:description", content: "Send expenses such as taxis to the office." }] }),
  component: Page,
});

// The `expenses` table and private `receipts` bucket are created by Lovable (see README → Expenses).
// Until the generated types include them, access them untyped.
type Status = "submitted" | "approved" | "rejected" | "paid";
interface Expense {
  id: string;
  user_id: string;
  event_id: string | null;
  day: string;
  category: string;
  amount: number;
  note: string | null;
  receipt_path: string | null;
  status: Status;
  office_note: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
  events?: { title: string; day: string } | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const expenses = () => (supabase as any).from("expenses");
// Stored values match the database check; "Transport" is shown as "Other transportations".
const CATEGORIES = ["Taxi", "Transport", "Meal", "Parking", "Supplies", "Other"];
const catLabel = (c: string) => (c === "Transport" ? "Other transportations" : c);
const STATUS_LABEL: Record<Status, string> = { submitted: "Waiting", approved: "Approved", rejected: "Rejected", paid: "Paid" };
// Top bar of each expense card: yellow while waiting, red if rejected, green once approved or paid.
const STATUS_BAR: Record<Status, string> = { submitted: "var(--warning)", rejected: "var(--destructive)", approved: "var(--success)", paid: "var(--success)" };
const STATUS_CLS: Record<Status, string> = { submitted: "", approved: "border-success text-success", rejected: "border-destructive text-destructive", paid: "bg-success text-success-foreground border-success" };
const isMissing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /expenses/.test(e.message ?? "") && /not find|does not exist/.test(e.message ?? ""));

function Page() {
  const { data: me } = useMe();
  if (!me) return null;
  return me.isOffice ? <OfficeExpenses /> : <MyExpenses userId={me.id} name={me.fullName} />;
}

function SetupNeeded() {
  return (
    <div className="rounded-xl border border-dashed bg-secondary/40 p-4 text-sm">
      <div className="font-semibold">Expenses needs one setup step</div>
      <p className="text-muted-foreground">Ask Lovable to create the expenses table and receipts storage (the prompt is in the README under "Expenses"), then republish.</p>
    </div>
  );
}

function StatusBadge({ s }: { s: Status }) {
  return <Badge variant="outline" className={STATUS_CLS[s]}>{STATUS_LABEL[s]}</Badge>;
}

async function openReceipt(path: string) {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 600);
  if (error) return toast.error(error.message);
  window.open(data.signedUrl, "_blank", "noopener");
}

// ── Worker ─────────────────────────────────────────────────────────────
function MyExpenses({ userId, name }: { userId: string; name: string }) {
  const qc = useQueryClient();
  const today = hkToday();
  const { data: invs = [] } = useMyInvitations(userId);
  const gigs = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; day: string }>();
    for (const i of invs)
      if ((i.status === "accepted" || i.status === "confirmed") && i.events && i.events.day <= today && !seen.has(i.events.id))
        seen.set(i.events.id, { id: i.events.id, day: i.events.day, label: `${fmtDay(i.events.day)} · ${i.events.client_name ?? i.events.title}` });
    return [...seen.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);
  }, [invs, today]);

  const { data, error } = useQuery({
    queryKey: ["my-expenses", userId],
    queryFn: async () => {
      const { data, error } = await expenses().select("*, events(title,day)").eq("user_id", userId).order("day", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    retry: false,
  });

  const [f, setF] = useState({ event_id: "", day: today, category: "Taxi", amount: "", note: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!(amount > 0)) return toast.error("Enter the amount");
    setBusy(true);
    try {
      let receipt_path: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        receipt_path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("receipts").upload(receipt_path, file, { contentType: file.type || undefined });
        if (up.error) throw up.error;
      }
      const ev = gigs.find((g) => g.id === f.event_id);
      const { error } = await expenses().insert({ user_id: userId, event_id: f.event_id || null, day: ev?.day ?? f.day, category: f.category, amount, note: f.note.trim() || null, receipt_path });
      if (error) throw error;
      await supabase.rpc("notify_office", {
        _title: `Expense: ${catLabel(f.category)} ${hkd(amount)} – ${name}`,
        _body: [ev?.label ?? fmtDay(f.day), f.note.trim(), file ? "Receipt attached" : "No receipt"].filter(Boolean).join(" · "),
        _link: "/expenses",
      });
      toast.success("Sent to the office");
      setF({ event_id: "", day: today, category: "Taxi", amount: "", note: "" });
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-expenses", userId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const list = data ?? [];
  const owed = list.filter((x) => x.status === "submitted" || x.status === "approved").reduce((s, x) => s + Number(x.amount), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Expenses</h1>
      {isMissing(error as never) ? <SetupNeeded /> : (
        <>
          <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold"><Receipt className="h-4 w-4" />Send an expense</h2>
            <div className="grid gap-1.5">
              <Label>Event</Label>
              <Select value={f.event_id || "none"} onValueChange={(v) => setF({ ...f, event_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked to an event</SelectItem>
                  {gigs.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Amount (HKD)</Label><Input type="number" inputMode="decimal" min={0} step="0.1" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
              {!f.event_id && <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={f.day} max={today} onChange={(e) => setF({ ...f, day: e.target.value })} /></div>}
            </div>
            <div className="grid gap-1.5"><Label>Details</Label><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Taxi home after midnight, Central to Tseung Kwan O" /></div>
            <div className="grid gap-1.5">
              <Label>Receipt</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm hover:bg-secondary">
                <Camera className="h-4 w-4" />
                <span className="truncate">{file ? file.name : "Take a photo or choose a file"}</span>
                <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send to office"}</Button>
          </form>

          <section className="space-y-2">
            <div className="flex items-center">
              <h2 className="mr-auto text-xl font-bold">My expenses</h2>
              {owed > 0 && <span className="text-sm text-muted-foreground">Still to be paid <span className="font-semibold text-foreground">{hkd(owed)}</span></span>}
            </div>
            {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing sent yet.</p>}
            {list.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm" style={{ borderTopColor: STATUS_BAR[x.status] }}>
                <div className="mr-auto min-w-0">
                  <div className="font-medium">{catLabel(x.category)} · {hkd(Number(x.amount))}</div>
                  <div className="truncate text-muted-foreground">{x.events ? `${fmtDay(x.events.day)} · ${x.events.title}` : fmtDay(x.day)}{x.note ? ` · ${x.note}` : ""}</div>
                  {x.office_note && <div className="text-xs">Office: {x.office_note}</div>}
                </div>
                {x.receipt_path && <Button size="icon" variant="ghost" onClick={() => openReceipt(x.receipt_path!)} aria-label="View receipt"><FileText className="h-4 w-4" /></Button>}
                <StatusBadge s={x.status} />
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

// ── Office ─────────────────────────────────────────────────────────────
function OfficeExpenses() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status | "all">("submitted");
  const [who, setWho] = useState("all");
  const { data, error } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await expenses().select("*, profiles(full_name), events(title,day)").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    retry: false,
  });
  if (isMissing(error as never)) return <div className="mx-auto max-w-4xl space-y-4"><h1 className="text-3xl font-bold">Expenses</h1><SetupNeeded /></div>;

  const all = data ?? [];
  const people = [...new Map(all.map((x) => [x.user_id, x.profiles?.full_name ?? "?"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const list = all.filter((x) => (who === "all" || x.user_id === who) && (status === "all" || x.status === status));
  const sum = (s: Status) => all.filter((x) => x.status === s).reduce((t, x) => t + Number(x.amount), 0);

  async function update(x: Expense, s: Status) {
    let office_note: string | null = x.office_note;
    if (s === "rejected") {
      const r = prompt("Reason (shown to the worker)", x.office_note ?? "");
      if (r === null) return;
      office_note = r.trim() || null;
    }
    const undo = s === "submitted";
    if (undo && !confirm(`Undo "${STATUS_LABEL[x.status]}" and put this expense back to Waiting?`)) return;
    const { error } = await expenses().update({ status: s, office_note: undo ? null : office_note, reviewed_at: undo ? null : new Date().toISOString() }).eq("id", x.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: x.user_id, title: `Expense ${undo ? "back to waiting" : STATUS_LABEL[s].toLowerCase()}: ${catLabel(x.category)} ${hkd(Number(x.amount))}`, body: undo ? null : office_note, link: "/expenses" });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  function download() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Worker", "Date", "Event", "Type", "Amount (HKD)", "Details", "Status", "Receipt"], ...list.map((x) => [x.profiles?.full_name, x.day, x.events?.title, catLabel(x.category), Number(x.amount).toFixed(2), x.note, STATUS_LABEL[x.status], x.receipt_path ? "Yes" : "No"])]
      .map((r) => r.map(esc).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `gig-agenda-expenses-${hkToday()}.csv`;
    a.click();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">Expenses</h1>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="w-44" aria-label="Worker"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workers</SelectItem>
            {people.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={download} disabled={!list.length}><Download className="h-4 w-4" />CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {([
          ["submitted", `Waiting ${hkd(sum("submitted"))}`],
          ["approved", `Approved, to pay ${hkd(sum("approved"))}`],
          ["paid", `Paid ${hkd(sum("paid"))}`],
          ["rejected", "Rejected"],
          ["all", "All"],
        ] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setStatus(v)} aria-pressed={status === v}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", status === v ? "border-success bg-success/10 text-success" : "border-border text-foreground hover:bg-secondary")}>
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs"><tr><th className="p-2">From</th><th className="p-2">Date / event</th><th className="p-2">Type</th><th className="p-2 text-right">Amount</th><th className="p-2">Details</th><th className="p-2">Receipt</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="p-3 text-muted-foreground">No expenses here.</td></tr>}
            {list.map((x) => (
              <tr key={x.id} className="border-t align-top">
                <td className="p-2 font-medium">{x.profiles?.full_name}</td>
                <td className="p-2">{fmtDay(x.day)}{x.events ? <div className="text-xs text-muted-foreground">{x.events.title}</div> : null}</td>
                <td className="p-2">{catLabel(x.category)}</td>
                <td className="p-2 text-right tabular-nums">{hkd(Number(x.amount))}</td>
                <td className="max-w-56 p-2 text-muted-foreground">{x.note}{x.office_note ? <div className="text-xs text-foreground">Office: {x.office_note}</div> : null}</td>
                <td className="p-2">{x.receipt_path ? <Button size="sm" variant="ghost" onClick={() => openReceipt(x.receipt_path!)}><FileText className="h-4 w-4" />View</Button> : <span className="text-xs text-muted-foreground">None</span>}</td>
                <td className="p-2"><StatusBadge s={x.status} /></td>
                <td className="p-2">
                  <div className={cn("flex justify-end gap-1")}>
                    {x.status === "submitted" && <Button size="sm" variant="outline" onClick={() => update(x, "approved")}><Check className="h-4 w-4" />Approve</Button>}
                    {(x.status === "submitted" || x.status === "approved") && <Button size="sm" onClick={() => update(x, "paid")}><Banknote className="h-4 w-4" />Paid</Button>}
                    {x.status === "submitted" && <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => update(x, "rejected")}>Reject</Button>}
                    {(x.status === "approved" || x.status === "rejected") && <Button size="sm" variant="ghost" onClick={() => update(x, "submitted")} title="Back to Waiting"><Undo2 className="h-4 w-4" />Undo</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
