import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePositions } from "@/lib/me";
import { inviteStaff } from "@/lib/staff.functions";
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
  const { data = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("*").order("full_name"), supabase.from("user_roles").select("user_id,role").eq("role", "office")]);
      const office = new Set((r.data ?? []).map((x) => x.user_id));
      return (p.data ?? []).map((x) => ({ ...x, isOffice: office.has(x.id) }));
    },
  });
  const pos = (id: string | null) => positions.find((p) => p.id === id)?.name;
  const list = data.filter((p) => !q || (p.full_name + " " + (p.email ?? "") + " " + (p.phone ?? "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">Staff</h1>
        <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
        <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add staff</Button>
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
