import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDays, hkToday } from "@/lib/time";
import { DEMO_DOMAIN, DEMO_PREFIX, DEMO_WORKERS, demoAvail } from "@/lib/demo-data";

/**
 * Demo staff live in the real tables so they show on every page (calendar, staff, availability,
 * reports, rates). They are recognisable by their @example.com e-mail and by demo events titled
 * "DEMO · …". They never receive e-mails (accounts are created confirmed, without a password).
 */

async function assertOffice(context: { supabase: { rpc: (fn: "is_office") => PromiseLike<{ data: unknown }> } }) {
  const { data } = await context.supabase.rpc("is_office");
  if (!data) throw new Error("Office only");
}

export const demoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOffice(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).like("email", `%@${DEMO_DOMAIN}`);
    return { workers: count ?? 0 };
  });

export const seedDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOffice(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    // 1. Positions (+ rates) used by the demo workers.
    const { data: existing = [] } = await db.from("positions").select("id,name,sort");
    const posId: Record<string, string> = {};
    let sort = (existing ?? []).reduce((m, p) => Math.max(m, p.sort), 0);
    for (const name of [...new Set(DEMO_WORKERS.map((w) => w.position))]) {
      const found = (existing ?? []).find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (found) {
        posId[name] = found.id;
        continue;
      }
      const { data: p, error } = await db.from("positions").insert({ name, sort: ++sort }).select("id").single();
      if (error) throw new Error(error.message);
      posId[name] = p.id;
    }
    const { data: rates = [] } = await db.from("position_rates").select("position_id,hourly_cost,client_rate");
    for (const [name, id] of Object.entries(posId)) {
      const w = DEMO_WORKERS.find((x) => x.position === name)!;
      const r = (rates ?? []).find((x) => x.position_id === id);
      if (!r) await db.from("position_rates").insert({ position_id: id, hourly_cost: w.rate, client_rate: w.client });
      else if (r.hourly_cost == null || r.client_rate == null)
        await db.from("position_rates").update({ hourly_cost: r.hourly_cost ?? w.rate, client_rate: r.client_rate ?? w.client }).eq("position_id", id);
    }

    // 2. Accounts + profiles.
    const { data: profs = [] } = await db.from("profiles").select("id,email").like("email", `%@${DEMO_DOMAIN}`);
    const idOf: Record<string, string> = {};
    for (const w of DEMO_WORKERS) {
      const email = `${w.slug}@${DEMO_DOMAIN}`;
      let id = (profs ?? []).find((p) => p.email === email)?.id;
      if (!id) {
        const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: w.name, demo: true } });
        if (error) throw new Error(`${w.name}: ${error.message}`);
        id = data.user.id;
      }
      idOf[w.slug] = id;
      const { error } = await db
        .from("profiles")
        .upsert({ id, email, full_name: w.name, phone: w.phone, main_position_id: posId[w.position]!, other_position_ids: w.also.map((n) => posId[n]).filter((x): x is string => !!x), personal_hourly_cost: w.personal ?? null, languages: w.languages, active: true });
      if (error) throw new Error(error.message);
    }
    const ids = Object.values(idOf);

    // 3. Availability for the next 4 weeks.
    const today = hkToday();
    await db.from("availability").delete().in("user_id", ids).gte("day", addDays(today, -1));
    const avail = [];
    for (const w of DEMO_WORKERS)
      for (let i = 0; i < 28; i++) {
        const day = addDays(today, i);
        const a = demoAvail(w.slug, day);
        if (a.status) avail.push({ user_id: idOf[w.slug]!, day, status: a.status, start_time: a.from ?? null, end_time: a.to ?? null });
      }
    if (avail.length) {
      const { error } = await db.from("availability").insert(avail);
      if (error) throw new Error(error.message);
    }

    // 4. Demo events with staff (past ones worked, upcoming ones partly answered).
    await removeDemoEvents(db);
    const plan = [-20, -16, -13, -9, -6, -3, -1, 2, 4, 7, 10, 14, 18];
    const clients = ["Skadden", "BNP Paribas", "Manulife", "Schroders", "Hastings & Co.", "Unlimit", "Phillips", "Jane Lah", "Kate Thorn", "Karen Birthday", "Ling Anniversary", "Barry Sears", "Roopali"];
    let n = 0;
    for (const off of plan) {
      const day = addDays(today, off);
      const client = clients[n % clients.length]!;
      const evening = n % 3 !== 0;
      const start = evening ? "18:00" : "11:30";
      const end = evening ? "22:30" : "15:00";
      const { data: ev, error } = await db
        .from("events")
        .insert({ source: "manual", title: `${DEMO_PREFIX}${client} ${evening ? "cocktail reception" : "lunch"}`, client_name: client, day, start_time: start, end_time: end, venue: "Central, Hong Kong", pax: 40 + (n % 4) * 20, state: "confirmed", notes: "Demo event – remove from Demo page" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const need: [string, number][] = [["Server", 3], ["Bartender", 1], ["Chef", evening ? 1 : 0], ["Event Manager", n % 2]];
      for (const [pos, qty] of need) {
        if (!qty) continue;
        const { data: row, error: e2 } = await db
          .from("staffing_rows")
          .insert({ event_id: ev.id, position_id: posId[pos]!, quantity: qty, start_time: addMin(start, -60), end_time: addMin(end, 30), break_minutes: evening ? 0 : 30 })
          .select("id")
          .single();
        if (e2) throw new Error(e2.message);
        const pool = DEMO_WORKERS.filter((w) => w.position === pos);
        const picks = Array.from({ length: Math.min(pool.length, qty + (off > 0 ? 1 : 0)) }, (_, k) => pool[(n + k) % pool.length]!);
        const inv = picks.map((w, k) => {
          const status = off <= 0 ? (k < qty ? "confirmed" : "declined") : k === 0 ? "confirmed" : k < qty ? (n % 2 ? "accepted" : "invited") : "invited";
          return { event_id: ev.id, staffing_row_id: row.id, user_id: idOf[w.slug]!, mode: "direct", status: status as "confirmed" | "accepted" | "invited" | "declined", responded_at: status === "invited" ? null : new Date().toISOString(), deadline: null, decline_reason: status === "declined" ? "Not available" : null };
        });
        if (inv.length) {
          const { error: e3 } = await db.from("invitations").insert(inv);
          if (e3) throw new Error(e3.message);
        }
      }
      n++;
    }
    return { workers: ids.length, events: plan.length };
  });

export const removeDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOffice(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await removeDemoEvents(db);
    const { data: profs = [] } = await db.from("profiles").select("id").like("email", `%@${DEMO_DOMAIN}`);
    const ids = (profs ?? []).map((p) => p.id);
    if (ids.length) {
      await db.from("invitations").delete().in("user_id", ids);
      await db.from("availability").delete().in("user_id", ids);
      await db.from("availability_patterns").delete().in("user_id", ids);
      await db.from("notifications").delete().in("user_id", ids);
      for (const id of ids) await db.auth.admin.deleteUser(id);
      await db.from("profiles").delete().in("id", ids);
    }
    return { removed: ids.length };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function removeDemoEvents(db: any) {
  const { data: evs = [] } = await db.from("events").select("id").eq("source", "manual").like("title", `${DEMO_PREFIX}%`);
  const ids = (evs ?? []).map((e: { id: string }) => e.id);
  if (!ids.length) return;
  await db.from("invitations").delete().in("event_id", ids);
  await db.from("staffing_rows").delete().in("event_id", ids);
  await db.from("events").delete().in("id", ids);
}

function addMin(t: string, m: number) {
  const [h = 0, mm = 0] = t.split(":").map(Number);
  const x = (h * 60 + mm + m + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}
