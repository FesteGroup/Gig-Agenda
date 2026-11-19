import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePositions } from "@/lib/me";
import { Avatar } from "@/components/app/Avatar";
import { RateSuggest } from "@/components/app/RateSuggest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff/$id")({
  head: () => ({ meta: [{ title: "Profile — Gig Agenda" }, { name: "description", content: "Staff profile." }, { property: "og:title", content: "Profile — Gig Agenda" }, { property: "og:description", content: "Staff profile." }] }),
  component: Page,
});

async function toThumb(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = 192, c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d")!;
  const m = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
  return c.toDataURL("image/jpeg", 0.8);
}

function Page() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const { data: positions = [] } = usePositions();
  const qc = useQueryClient();
  const office = !!me?.isOffice;

  const { data } = useQuery({
    queryKey: ["profile", id, office],
    enabled: !!me,
    queryFn: async () => {
      const p = await supabase.from("profiles").select("*").eq("id", id).single();
      const notes = office ? (await supabase.from("staff_notes").select("notes").eq("user_id", id).maybeSingle()).data?.notes ?? "" : "";
      const roles = office ? (await supabase.from("user_roles").select("role").eq("user_id", id)).data ?? [] : [];
      // Latest rate suggestion from this worker (sent to the office as a notification).
      const sug = office
        ? (await supabase.from("notifications").select("title,created_at").eq("link", `/staff/${id}`).like("title", "Rate suggestion:%").order("created_at", { ascending: false }).limit(1).maybeSingle()).data
        : null;
      const suggested = sug ? Number(/HK\$(\d+(?:\.\d+)?)\/h/.exec(sug.title)?.[1] ?? NaN) : NaN;
      return { p: p.data, notes, isOffice: roles.some((r) => r.role === "office"), suggestion: Number.isFinite(suggested) ? { rate: suggested, at: sug!.created_at } : null };
    },
  });

  const [f, setF] = useState<NonNullable<typeof data>["p"] | null>(null);
  const [notes, setNotes] = useState("");
  const [langs, setLangs] = useState("");
  useEffect(() => {
    if (data?.p) { setF(data.p); setNotes(data.notes); setLangs(data.p.languages.join(", ")); }
  }, [data]);
  if (!f) return <p className="text-muted-foreground">Loading…</p>;

  async function save() {
    if (!f) return;
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name, phone: f.phone, email: f.email, photo_url: f.photo_url,
      main_position_id: f.main_position_id, other_position_ids: f.other_position_ids,
      languages: langs.split(",").map((s) => s.trim()).filter(Boolean),
      ...(office ? { personal_hourly_cost: f.personal_hourly_cost, active: f.active } : {}),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    if (office) await supabase.from("staff_notes").upsert({ user_id: id, notes });
    toast.success("Saved");
    qc.invalidateQueries();
  }

  async function toggleOffice(v: boolean) {
    const { error } = v
      ? await supabase.from("user_roles").insert({ user_id: id, role: "office" })
      : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "office");
    if (error) return toast.error(error.message);
    toast.success(v ? "Promoted to office" : "Office access removed");
    qc.invalidateQueries({ queryKey: ["profile", id] });
  }

  const toggleOther = (pid: string) =>
    setF({ ...f, other_position_ids: f.other_position_ids.includes(pid) ? f.other_position_ids.filter((x) => x !== pid) : [...f.other_position_ids, pid] });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-4">
        <label className="cursor-pointer" title="Change photo">
          <Avatar name={f.full_name} url={f.photo_url} size={72} />
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, photo_url: await toThumb(file) }); }} />
        </label>
        <div>
          <h1 className="text-2xl font-bold">{f.full_name || "Profile"}</h1>
          <p className="text-xs text-muted-foreground">Tap the photo to change it</p>
        </div>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-1.5"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5"><Label>Phone (WhatsApp)</Label><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Email</Label><Input value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div className="grid gap-1.5">
          <Label>Main position</Label>
          <Select value={f.main_position_id ?? ""} onValueChange={(v) => setF({ ...f, main_position_id: v })}>
            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Can also cover</Label>
          <div className="flex flex-wrap gap-1.5">
            {positions.filter((p) => p.id !== f.main_position_id).map((p) => (
              <button key={p.id} type="button" onClick={() => toggleOther(p.id)} className={cn("rounded-full border px-3 py-1 text-sm", f.other_position_ids.includes(p.id) ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>{p.name}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5"><Label>Languages</Label><Input value={langs} onChange={(e) => setLangs(e.target.value)} placeholder="English, Cantonese, Mandarin" /></div>
        {!office && me?.id === id && <RateSuggest userId={id} name={f.full_name} positionId={data?.p?.main_position_id ?? null} />}
        {office && (
          <>
            <div className="grid gap-1.5">
              <Label>Personal hourly cost (HKD, overrides position)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" value={f.personal_hourly_cost ?? ""} onChange={(e) => setF({ ...f, personal_hourly_cost: e.target.value === "" ? null : Number(e.target.value) })} className="flex-1" />
                {data?.suggestion && data.suggestion.rate !== f.personal_hourly_cost && (
                  <button type="button" onClick={() => setF({ ...f, personal_hourly_cost: data.suggestion!.rate })} title="Use this rate (then Save)" className="shrink-0 text-sm italic text-muted-foreground hover:text-foreground">
                    Suggested HK${data.suggestion.rate}/h · {new Date(data.suggestion.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-1.5"><Label>Office notes (staff can't see)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} id="active" /><Label htmlFor="active">Show</Label></div>
            {me?.id !== id && <div className="flex items-center gap-2"><Switch checked={!!data?.isOffice} onCheckedChange={toggleOffice} id="off" /><Label htmlFor="off">Office access</Label></div>}
          </>
        )}
        <Button onClick={save} className="mt-2">Save</Button>
      </div>
    </div>
  );
}
