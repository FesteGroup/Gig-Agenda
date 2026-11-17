import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IMPORT_NOTE, IMPORT_SHIFTS, IMPORT_WORKERS, RELISH_STAFF_DOMAIN } from "@/lib/relish-staff-data";

/**
 * Adds the real Relish workers, their rates and their past shifts from the servers' payment file.
 * Safe to run again: workers are matched by e-mail, events by Puree order or by day + title,
 * and the imported shifts on those events are replaced.
 * Workers get a placeholder e-mail (name@staff.relish.com.hk) and no password, so no e-mail is sent.
 */
export const importRelishStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: office } = await context.supabase.rpc("is_office");
    if (!office) throw new Error("Office only");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const fail = (m: string, e: { message: string } | null) => {
      if (e) throw new Error(`${m}: ${e.message}`);
    };

    // 1. Positions and rates (Server HK$150 extra hour after the HK$650 4-hour block, Bartender HK$200, Mixologist HK$300).
    const RATES: Record<string, number> = { Server: 150, Bartender: 200, Mixologist: 300 };
    const { data: positions } = await db.from("positions").select("id,name,sort");
    let sort = (positions ?? []).reduce((m, p) => Math.max(m, p.sort), 0);
    const posId: Record<string, string> = {};
    for (const name of Object.keys(RATES)) {
      const found = (positions ?? []).find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
      if (found) posId[name] = found.id;
      else {
        const { data, error } = await db.from("positions").insert({ name, sort: ++sort }).select("id").single();
        fail(`Position ${name}`, error);
        posId[name] = data!.id;
      }
      const { error } = await db.from("position_rates").upsert({ position_id: posId[name]!, hourly_cost: RATES[name]! }, { onConflict: "position_id" });
      fail(`Rate ${name}`, error);
    }

    // 2. Workers.
    const { data: profs } = await db.from("profiles").select("id,email,full_name");
    const idOf: Record<string, string> = {};
    for (const w of IMPORT_WORKERS) {
      const email = `${w.key}@${RELISH_STAFF_DOMAIN}`;
      const first = w.name.match(/\((\w+)\)/)?.[1] ?? w.name;
      let id = (profs ?? []).find((p) => p.email?.toLowerCase() === email || p.full_name.trim().toLowerCase() === w.name.toLowerCase())?.id;
      if (!id) {
        const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: w.name } });
        fail(first, error);
        id = data.user!.id;
      }
      idOf[w.key] = id;
      const { error } = await db
        .from("profiles")
        .update({ full_name: w.name, main_position_id: posId[w.position]!, personal_hourly_cost: w.senior ? 180 : null, active: true })
        .eq("id", id);
      fail(first, error);
      if (w.note) {
        const { data: existing } = await db.from("staff_notes").select("notes").eq("user_id", id).maybeSingle();
        if (!existing?.notes?.includes(w.note)) {
          const { error: e2 } = await db.from("staff_notes").upsert({ user_id: id, notes: [existing?.notes, w.note].filter(Boolean).join("\n") }, { onConflict: "user_id" });
          fail(`${first} note`, e2);
        }
      }
    }
    const workerIds = Object.values(idOf);

    // 3. Events (Puree order when there is one, otherwise a manual event), shifts and confirmed staff.
    const eventId: Record<string, string> = {};
    let shifts = 0;
    for (const s of IMPORT_SHIFTS) {
      const key = s.puree ? `p${s.puree.puree_id}` : `${s.day}|${s.client}`;
      let id = eventId[key];
      if (!id) {
        if (s.puree) {
          const { data, error } = await db
            .from("events")
            .upsert(
              { source: "puree", account: "relish", puree_id: s.puree.puree_id, reference: s.puree.reference, title: s.puree.title, client_name: s.puree.client_name, day: s.day, state: s.puree.state, order_url: s.puree.order_url, pax: s.puree.pax },
              { onConflict: "account,puree_id" },
            )
            .select("id")
            .single();
          fail(s.client, error);
          id = data!.id;
        } else {
          const { data: found } = await db.from("events").select("id").eq("source", "manual").eq("day", s.day).eq("title", s.client).maybeSingle();
          if (found) id = found.id;
          else {
            const { data, error } = await db.from("events").insert({ source: "manual", title: s.client, client_name: s.client, day: s.day, start_time: s.start, state: "confirmed", notes: IMPORT_NOTE }).select("id").single();
            fail(s.client, error);
            id = data!.id;
          }
        }
        eventId[key] = id;
        // Replace earlier imported shifts on this event.
        await db.from("invitations").delete().eq("event_id", id).in("user_id", workerIds);
        const { data: rows } = await db.from("staffing_rows").select("id, invitations(id)").eq("event_id", id);
        const empty = (rows ?? []).filter((r) => !r.invitations?.length).map((r) => r.id);
        if (empty.length) await db.from("staffing_rows").delete().in("id", empty);
      }
      const notes = [s.note].filter(Boolean);
      if (notes.length) {
        const { data: ev } = await db.from("events").select("notes").eq("id", id).single();
        const missing = notes.filter((n) => !(ev?.notes ?? "").includes(n));
        if (missing.length) await db.from("events").update({ notes: [ev?.notes, ...missing].filter(Boolean).join("\n") }).eq("id", id);
      }
      const { data: row, error } = await db
        .from("staffing_rows")
        .insert({ event_id: id, position_id: posId[s.position]!, quantity: s.names.length, start_time: s.start, end_time: s.end, break_minutes: s.break })
        .select("id")
        .single();
      fail(`${s.client} ${s.day}`, error);
      const now = new Date().toISOString();
      const { error: e3 } = await db.from("invitations").insert(
        s.names.map((n) => ({ event_id: id!, staffing_row_id: row!.id, user_id: idOf[n.toLowerCase()]!, mode: "direct", status: "confirmed" as const, responded_at: now, deadline: null, decline_reason: null })),
      );
      fail(`${s.client} ${s.day} staff`, e3);
      shifts += s.names.length;
    }
    return { workers: workerIds.length, events: Object.keys(eventId).length, shifts };
  });
