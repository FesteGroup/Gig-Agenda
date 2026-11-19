import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isGingersPosition, shortPositionName } from "@/lib/gingers";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Positions & rates — Gig Agenda" }, { name: "description", content: "Hourly costs and client rates." }, { property: "og:title", content: "Positions & rates — Gig Agenda" }, { property: "og:description", content: "Hourly costs and client rates." }] }),
  component: Page,
});

const num = (v: string) => (v === "" ? null : Number(v));

function Page() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const [p, r, o, w] = await Promise.all([
        supabase.from("positions").select("*").order("sort"),
        supabase.from("position_rates").select("*"),
        supabase.from("overtime_rates").select("*").order("sort"),
        supabase.from("profiles").select("id,full_name,main_position_id,personal_hourly_cost").eq("active", true).order("full_name"),
      ]);
      return { positions: p.data ?? [], rates: r.data ?? [], ot: o.data ?? [], workers: w.data ?? [] };
    },
  });
  const [newName, setNewName] = useState("");
  const [openPos, setOpenPos] = useState<string[]>([]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["positions"] }); qc.invalidateQueries({ queryKey: ["rates"] }); qc.invalidateQueries({ queryKey: ["overtime"] }); };

  async function updPos(id: string, patch: { name?: string; color?: string }) {
    const { error } = await supabase.from("positions").update(patch).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }
  async function updRate(position_id: string, patch: { hourly_cost?: number | null; client_rate?: number | null }) {
    const { error } = await supabase.from("position_rates").upsert({ position_id, ...patch });
    if (error) toast.error(error.message); else refresh();
  }
  // A worker's personal hourly rate (empty = the position's rate). Shown under their main position.
  async function updWorker(id: string, personal_hourly_cost: number | null) {
    const { error } = await supabase.from("profiles").update({ personal_hourly_cost }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Personal rate saved"); refresh(); qc.invalidateQueries({ queryKey: ["staff"] }); }
  }
  async function addPos() {
    if (!newName.trim()) return;
    const { data: p, error } = await supabase.from("positions").insert({ name: newName.trim(), sort: (data?.positions.length ?? 0) + 1 }).select("id").single();
    if (error) return toast.error(error.message);
    await supabase.from("position_rates").insert({ position_id: p.id });
    setNewName("");
    refresh();
  }
  async function delPos(id: string) {
    if (!confirm("Delete this position?")) return;
    const { error } = await supabase.from("positions").delete().eq("id", id);
    if (error) toast.error("In use on events — can't delete"); else refresh();
  }
  async function updOt(id: string, client_rate: number) {
    await supabase.from("overtime_rates").update({ client_rate }).eq("id", id);
    refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">Positions & rates</h1>
        <p className="text-sm text-muted-foreground">
          Gingers positions are paid a flat hourly cost and use Gingers' own after-midnight client rates
          (F&amp;B Manager HK$290/h, Waiter and Commis Chef HK$240/h). On Hong Kong public holidays their fees are doubled; after
          midnight on a holiday: F&amp;B Manager HK$720/h, Waiter and Commis Chef HK$570/h.
        </p>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-base">
            <thead className="bg-secondary text-left text-sm font-semibold text-muted-foreground">
              <tr><th className="p-3">Colour</th><th className="p-3">Position</th><th className="p-3">Cost to us / h</th><th className="p-3">Client rate / h</th><th /></tr>
            </thead>
            <tbody>
              {data?.positions.map((p) => {
                const r = data.rates.find((x) => x.position_id === p.id);
                const workers = data.workers.filter((w) => w.main_position_id === p.id);
                return (
                  <Fragment key={p.id + (r?.hourly_cost ?? "") + (r?.client_rate ?? "")}>
                  <tr className="border-t">
                    <td className="p-3"><input type="color" defaultValue={p.color} onBlur={(e) => e.target.value !== p.color && updPos(p.id, { color: e.target.value })} className="h-11 w-16 cursor-pointer rounded border-0 bg-transparent" aria-label="Colour" /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isGingersPosition(p.name) ? (
                          <>
                            {/* Shown without the "Gingers · " prefix; it is kept in the saved name. */}
                            <Input defaultValue={shortPositionName(p.name)} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== shortPositionName(p.name)) updPos(p.id, { name: `Gingers · ${v}` }); }} className="h-11 text-base md:text-base" />
                            <span className="shrink-0 text-sm text-muted-foreground">Gingers</span>
                          </>
                        ) : (
                          <Input defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && updPos(p.id, { name: e.target.value })} className="h-11 text-base md:text-base" />
                        )}
                      </div>
                      {workers.length > 0 && (
                        <button type="button" onClick={() => setOpenPos((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))} className="mt-1 text-xs font-medium text-primary hover:underline">
                          {openPos.includes(p.id) ? "Hide" : `View all (${workers.length})`}
                        </button>
                      )}
                    </td>
                    <td className="p-3"><Input type="number" defaultValue={r?.hourly_cost ?? ""} placeholder="—" onBlur={(e) => num(e.target.value) !== (r?.hourly_cost ?? null) && updRate(p.id, { hourly_cost: num(e.target.value) })} className="h-11 text-base md:text-base" /></td>
                    <td className="p-3"><Input type="number" defaultValue={r?.client_rate ?? ""} placeholder="—" onBlur={(e) => num(e.target.value) !== (r?.client_rate ?? null) && updRate(p.id, { client_rate: num(e.target.value) })} className="h-11 text-base md:text-base" /></td>
                    <td className="p-3"><Button size="icon" variant="ghost" onClick={() => delPos(p.id)} aria-label="Delete" className="h-11 w-11"><Trash2 className="h-5 w-5" /></Button></td>
                  </tr>
                  {workers.length > 0 && openPos.includes(p.id) && (
                    <tr>
                      <td />
                      <td colSpan={4} className="px-3 pb-3">
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {workers.map((w) => (
                            <label key={w.id + (w.personal_hourly_cost ?? "")} className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1 text-sm">
                              <span className="min-w-0 flex-1 truncate">{w.full_name}</span>
                              <Input
                                type="number"
                                min={0}
                                defaultValue={w.personal_hourly_cost ?? ""}
                                placeholder={r?.hourly_cost != null ? String(r.hourly_cost) : "—"}
                                onBlur={(e) => num(e.target.value) !== (w.personal_hourly_cost ?? null) && updWorker(w.id, num(e.target.value))}
                                className="h-8 w-20 text-right"
                                aria-label={`${w.full_name} hourly rate`}
                              />
                              <span className="text-xs text-muted-foreground">/h</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Under each position: its workers and their personal hourly rate. Leave it empty to use the position's cost; the personal rate applies to every position the worker does.</p>
        <div className="flex gap-2"><Input placeholder="New position" value={newName} onChange={(e) => setNewName(e.target.value)} className="max-w-xs" /><Button onClick={addPos}>Add</Button></div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">After-midnight client rates</h2>
        <p className="text-sm text-muted-foreground">Per person per hour. Applied on an event when you switch on “After-midnight rates”.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {data?.ot.map((o) => (
            <div key={o.id + o.client_rate} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <span className="flex-1 text-sm font-medium">{o.label}</span>
              <Input type="number" className="w-28" defaultValue={o.client_rate} onBlur={(e) => Number(e.target.value) !== Number(o.client_rate) && updOt(o.id, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
