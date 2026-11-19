// Server-only: read-only Gig Agenda answers for the Calendar's AI assistant connector (Grok).
// Office accounts only. Staff contact details (phone, email) are not shared.
import { shiftHours } from "@/lib/time";
import { staffCost } from "@/lib/costs";

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "");
const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
const BOOKED = new Set(["accepted", "confirmed"]);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The Grok user must have office access in Gig Agenda. */
export async function isOfficeEmail(email: string) {
  const sb = await admin();
  const { data: prof } = await sb.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!prof) return false;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", prof.id);
  return !!roles?.some((r) => r.role === "office");
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

async function basics() {
  const sb = await admin();
  const [positions, rates, profiles] = await Promise.all([
    sb.from("positions").select("id,name"),
    sb.from("position_rates").select("position_id,hourly_cost,client_rate"),
    sb.from("profiles").select("id,full_name,active,main_position_id,other_position_ids,languages,personal_hourly_cost"),
  ]);
  const pos = new Map(check(positions).map((p) => [p.id, p.name]));
  const rate = new Map(check(rates).map((r) => [r.position_id, r]));
  const people = new Map(check(profiles).map((p) => [p.id, p]));
  return { sb, pos, rate, people };
}

export async function answerGigAgenda(tool: string, a: Args) {
  const from = day(a["from"]);
  const to = day(a["to"]);
  const { sb, pos, rate, people } = await basics();
  const name = (id: string) => people.get(id)?.full_name || "Unknown";

  if (tool === "staff_events") {
    let q = sb.from("events").select("id,account,title,client_name,day,start_time,end_time,venue,pax,reference,state,source").order("day");
    if (from) q = q.gte("day", from);
    if (to) q = q.lte("day", to);
    const events = check(await q.limit(300));
    const ids = events.map((e) => e.id);
    const [rows, invs] = ids.length
      ? await Promise.all([
          sb.from("staffing_rows").select("id,event_id,position_id,quantity,start_time,end_time,break_minutes").in("event_id", ids),
          sb.from("invitations").select("event_id,staffing_row_id,user_id,status,decline_reason").in("event_id", ids),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const rowList = check(rows as { data: { id: string; event_id: string; position_id: string; quantity: number; start_time: string; end_time: string; break_minutes: number }[] | null; error: { message: string } | null });
    const invList = check(invs as { data: { event_id: string; staffing_row_id: string; user_id: string; status: string; decline_reason: string | null }[] | null; error: { message: string } | null });
    return {
      count: events.length,
      events: events.map((e) => {
        const er = rowList.filter((r) => r.event_id === e.id);
        return {
          date: e.day,
          start: hm(e.start_time),
          end: hm(e.end_time),
          account: e.account,
          quote: e.reference,
          title: e.title,
          client: e.client_name,
          venue: e.venue,
          guests: e.pax,
          status: e.state,
          staffing: er.map((r) => {
            const inv = invList.filter((i) => i.staffing_row_id === r.id);
            const booked = inv.filter((i) => BOOKED.has(i.status));
            return {
              position: pos.get(r.position_id) ?? null,
              needed: r.quantity,
              booked: booked.length,
              missing: Math.max(0, r.quantity - booked.length),
              shift: `${hm(r.start_time)}–${hm(r.end_time)}`,
              booked_staff: booked.map((i) => name(i.user_id)),
              invited_waiting: inv.filter((i) => i.status === "invited").map((i) => name(i.user_id)),
              declined: inv
                .filter((i) => i.status === "declined" && !/already|taken|occupied|clash/i.test(i.decline_reason ?? ""))
                .map((i) => name(i.user_id)),
            };
          }),
        };
      }),
    };
  }

  if (tool === "staff_hours") {
    const who = str(a["worker"]).toLowerCase();
    let q = sb.from("events").select("id,day,title,client_name,account,notes");
    if (from) q = q.gte("day", from);
    if (to) q = q.lte("day", to);
    const events = check(await q.limit(2000));
    const evById = new Map(events.map((e) => [e.id, e]));
    const ids = events.map((e) => e.id);
    if (!ids.length) return { count: 0, workers: [] };
    const all: { staffing_row_id: string; user_id: string; event_id: string }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const part = check(
        await sb.from("invitations").select("staffing_row_id,user_id,event_id").in("event_id", ids.slice(i, i + 200)).in("status", ["accepted", "confirmed"]),
      );
      all.push(...part);
    }
    const rowIds = [...new Set(all.map((i) => i.staffing_row_id))];
    const rows = new Map<string, { position_id: string; start_time: string; end_time: string; break_minutes: number }>();
    for (let i = 0; i < rowIds.length; i += 200) {
      for (const r of check(await sb.from("staffing_rows").select("id,position_id,start_time,end_time,break_minutes").in("id", rowIds.slice(i, i + 200))))
        rows.set(r.id, r);
    }
    const by = new Map<string, { name: string; shifts: number; hours: number; cost: number; costKnown: boolean; events: string[] }>();
    for (const inv of all) {
      const r = rows.get(inv.staffing_row_id);
      const ev = evById.get(inv.event_id);
      if (!r || !ev) continue;
      const n = name(inv.user_id);
      if (who && !n.toLowerCase().includes(who)) continue;
      const h = shiftHours(r.start_time, r.end_time, r.break_minutes ?? 0);
      const p = people.get(inv.user_id);
      const c = staffCost(h, p?.personal_hourly_cost, rate.get(r.position_id)?.hourly_cost);
      const t = by.get(inv.user_id) ?? { name: n, shifts: 0, hours: 0, cost: 0, costKnown: true, events: [] };
      t.shifts += 1;
      t.hours += h;
      if (c == null) t.costKnown = false;
      else t.cost += c;
      t.events.push(`${ev.day} ${ev.title} (${pos.get(r.position_id) ?? "?"}, ${h.toFixed(1)} h)`);
      by.set(inv.user_id, t);
    }
    const workers = [...by.values()]
      .sort((x, y) => y.hours - x.hours)
      .map((t) => ({
        name: t.name,
        shifts: t.shifts,
        hours: Math.round(t.hours * 10) / 10,
        estimated_cost_hkd: t.costKnown ? Math.round(t.cost) : null,
        shifts_list: t.events.sort(),
      }));
    return {
      period: { from: from || null, to: to || null },
      count: workers.length,
      total_hours: Math.round(workers.reduce((s, w) => s + w.hours, 0) * 10) / 10,
      workers,
      note: "Accepted or confirmed shifts, including past shifts imported from Xero. Cost is hours × hourly rate, before holiday doubling.",
    };
  }

  if (tool === "staff_list") {
    const q = str(a["search"]).toLowerCase();
    const position = str(a["position"]).toLowerCase();
    const list = [...people.values()]
      .map((p) => ({
        name: p.full_name,
        active: p.active,
        main_position: pos.get(p.main_position_id ?? "") ?? null,
        other_positions: (p.other_position_ids ?? []).map((id) => pos.get(id)).filter(Boolean),
        languages: p.languages,
        hourly_cost_hkd: p.personal_hourly_cost ?? rate.get(p.main_position_id ?? "")?.hourly_cost ?? null,
      }))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .filter((p) => !position || [p.main_position, ...p.other_positions].some((x) => (x ?? "").toLowerCase().includes(position)))
      .sort((x, y) => x.name.localeCompare(y.name));
    return { count: list.length, staff: list };
  }

  if (tool === "staff_availability") {
    let q = sb.from("availability").select("user_id,day,status,start_time,end_time").order("day");
    if (from) q = q.gte("day", from);
    if (to) q = q.lte("day", to);
    const rows = check(await q.limit(3000));
    const days = new Map<string, { available: string[]; partial: string[]; unavailable: string[] }>();
    for (const r of rows) {
      const d = days.get(r.day) ?? { available: [], partial: [], unavailable: [] };
      const label = r.status === "partial" ? `${name(r.user_id)} (${hm(r.start_time)}–${hm(r.end_time)})` : name(r.user_id);
      d[r.status].push(label);
      days.set(r.day, d);
    }
    return {
      days: [...days.entries()].map(([date, d]) => ({ date, ...d })),
      note: "Only days staff have marked; weekly patterns are not expanded.",
    };
  }

  throw new Error(`Unknown tool ${tool}`);
}
