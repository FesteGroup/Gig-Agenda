import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { IMPORT_NOTE, IMPORT_SHIFTS, IMPORT_WORKERS, RELISH_STAFF_DOMAIN } from "@/lib/relish-staff-data";

/**
 * Adds the real Relish workers, their rates and their past shifts from the servers' payment file.
 * Runs in small steps (the host limits how many requests one call can make):
 *   step "workers" with offset 0, 8, 16… creates the accounts, then step "shifts" adds all events and shifts.
 * Safe to run again: workers are matched by e-mail, events by Puree order or day + title,
 * and the imported shifts on those events are replaced.
 * Workers get a placeholder e-mail (name@staff.relish.com.hk) and no password, so no e-mail is sent.
 */
const BATCH = 8;
const emailOf = (key: string) => `${key}@${RELISH_STAFF_DOMAIN}`;

export const importRelishStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ step: z.enum(["workers", "shifts"]), offset: z.number().int().min(0).default(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase; // office user: RLS allows it and the profile guard keeps personal rates
    const { data: office } = await sb.rpc("is_office");
    if (!office) throw new Error("Office only");
    const fail = (m: string, e: { message: string } | null) => {
      if (e) throw new Error(`${m}: ${e.message}`);
    };

    // Positions + rates (Server HK$150 extra hour after the HK$650 4-hour block, Bartender HK$200, Mixologist HK$300).
    const RATES: Record<string, number> = { Server: 150, Bartender: 200, Mixologist: 300 };
    const { data: positions, error: pe } = await sb.from("positions").select("id,name,sort");
    fail("Positions", pe);
    const posId: Record<string, string> = {};
    for (const p of positions ?? []) for (const n of Object.keys(RATES)) if (p.name.trim().toLowerCase() === n.toLowerCase()) posId[n] = p.id;

    if (data.step === "workers") {
      if (data.offset === 0) {
        let sort = (positions ?? []).reduce((m, p) => Math.max(m, p.sort), 0);
        const missing = Object.keys(RATES).filter((n) => !posId[n]);
        if (missing.length) {
          const { data: created, error } = await sb.from("positions").insert(missing.map((name) => ({ name, sort: ++sort }))).select("id,name");
          fail("Positions", error);
          for (const p of created ?? []) posId[p.name] = p.id;
        }
        const { error } = await sb.from("position_rates").upsert(Object.entries(RATES).map(([n, r]) => ({ position_id: posId[n]!, hourly_cost: r })), { onConflict: "position_id" });
        fail("Rates", error);
      }
      const batch = IMPORT_WORKERS.slice(data.offset, data.offset + BATCH);
      const { data: profs } = await sb.from("profiles").select("id,email").in("email", batch.map((w) => emailOf(w.key)));
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const ids: Record<string, string> = {};
      for (const w of batch) {
        let id = (profs ?? []).find((p) => p.email?.toLowerCase() === emailOf(w.key))?.id;
        if (!id) {
          const { data: u, error } = await supabaseAdmin.auth.admin.createUser({ email: emailOf(w.key), email_confirm: true, user_metadata: { full_name: w.name } });
          fail(w.name, error);
          id = u.user!.id;
        }
        ids[w.key] = id;
      }
      const { error: e1 } = await sb.from("profiles").upsert(
        batch.map((w) => ({ id: ids[w.key]!, email: emailOf(w.key), full_name: w.name, main_position_id: posId[w.position] ?? null, personal_hourly_cost: w.senior ? 180 : null, active: true })),
        { onConflict: "id" },
      );
      fail("Profiles", e1);
      const withNotes = batch.filter((w) => w.note);
      if (withNotes.length) {
        const { data: existing } = await sb.from("staff_notes").select("user_id,notes").in("user_id", withNotes.map((w) => ids[w.key]!));
        const rows = withNotes.map((w) => {
          const old = existing?.find((n) => n.user_id === ids[w.key])?.notes ?? "";
          return { user_id: ids[w.key]!, notes: old.includes(w.note) ? old : [old, w.note].filter(Boolean).join("\n") };
        });
        const { error } = await sb.from("staff_notes").upsert(rows, { onConflict: "user_id" });
        fail("Notes", error);
      }
      const next = data.offset + BATCH;
      return { step: "workers" as const, done: next >= IMPORT_WORKERS.length, next, total: IMPORT_WORKERS.length };
    }

    // ── shifts ──
    const { data: profs, error: e0 } = await sb.from("profiles").select("id,email").like("email", `%@${RELISH_STAFF_DOMAIN}`);
    fail("Workers", e0);
    const idOf: Record<string, string> = {};
    for (const w of IMPORT_WORKERS) {
      const id = profs?.find((p) => p.email?.toLowerCase() === emailOf(w.key))?.id;
      if (!id) throw new Error(`${w.name} is missing – run the import again`);
      idOf[w.key] = id;
    }
    for (const n of ["Server", "Bartender"]) if (!posId[n]) throw new Error(`Position ${n} is missing – run the import again`);

    // Events: Puree ones in one upsert, manual ones matched by day + title, missing ones in one insert.
    const keyOf = (s: (typeof IMPORT_SHIFTS)[number]) => (s.puree ? `p${s.puree.puree_id}` : `${s.day}|${s.client}`);
    const eventId: Record<string, string> = {};
    const pureeRows = [...new Map(IMPORT_SHIFTS.filter((s) => s.puree).map((s) => [s.puree!.puree_id, s])).values()].map((s) => ({
      source: "puree", account: "relish", puree_id: s.puree!.puree_id, reference: s.puree!.reference, title: s.puree!.title, client_name: s.puree!.client_name, day: s.day, state: s.puree!.state, order_url: s.puree!.order_url, pax: s.puree!.pax,
    }));
    const { data: pe2, error: e2 } = await sb.from("events").upsert(pureeRows, { onConflict: "account,puree_id" }).select("id,puree_id");
    fail("Puree events", e2);
    for (const e of pe2 ?? []) eventId[`p${e.puree_id}`] = e.id;

    const manual = [...new Map(IMPORT_SHIFTS.filter((s) => !s.puree).map((s) => [keyOf(s), s])).values()];
    const { data: found, error: e3 } = await sb.from("events").select("id,day,title").eq("source", "manual").in("title", [...new Set(manual.map((s) => s.client))]);
    fail("Events", e3);
    for (const e of found ?? []) eventId[`${e.day}|${e.title}`] ??= e.id;
    const toCreate = manual.filter((s) => !eventId[keyOf(s)]);
    if (toCreate.length) {
      const { data: created, error } = await sb
        .from("events")
        .insert(toCreate.map((s) => ({ source: "manual", title: s.client, client_name: s.client, day: s.day, start_time: s.start, state: "confirmed", notes: IMPORT_NOTE })))
        .select("id,day,title");
      fail("New events", error);
      for (const e of created ?? []) eventId[`${e.day}|${e.title}`] = e.id;
    }
    const evIds = [...new Set(Object.values(eventId))];

    // Replace earlier imported shifts on these events.
    const workerIds = Object.values(idOf);
    const { error: e4 } = await sb.from("invitations").delete().in("event_id", evIds).in("user_id", workerIds);
    fail("Clear old shifts", e4);
    const { data: oldRows } = await sb.from("staffing_rows").select("id, invitations(id)").in("event_id", evIds);
    const empty = (oldRows ?? []).filter((r) => !r.invitations?.length).map((r) => r.id);
    if (empty.length) await sb.from("staffing_rows").delete().in("id", empty);

    // Notes from the file (taxi, public holiday…).
    const notesBy: Record<string, string[]> = {};
    for (const s of IMPORT_SHIFTS) if (s.note) (notesBy[eventId[keyOf(s)]!] ??= []).push(s.note);
    if (Object.keys(notesBy).length) {
      const { data: evs } = await sb.from("events").select("id,notes").in("id", Object.keys(notesBy));
      for (const e of evs ?? []) {
        const add = [...new Set(notesBy[e.id])].filter((n) => !(e.notes ?? "").includes(n));
        if (add.length) await sb.from("events").update({ notes: [e.notes, ...add].filter(Boolean).join("\n") }).eq("id", e.id);
      }
    }

    // Staffing rows (one insert), then confirmed staff (one insert).
    const rowsIn = IMPORT_SHIFTS.map((s) => ({ event_id: eventId[keyOf(s)]!, position_id: posId[s.position]!, quantity: s.names.length, start_time: s.start, end_time: s.end, break_minutes: s.break }));
    const { data: rowsOut, error: e5 } = await sb.from("staffing_rows").insert(rowsIn).select("id,event_id,position_id,start_time,end_time");
    fail("Shifts", e5);
    const t5 = (t: string) => t.slice(0, 5);
    const now = new Date().toISOString();
    const used = new Set<string>();
    const invites = IMPORT_SHIFTS.flatMap((s, k) => {
      const want = rowsIn[k]!;
      const row = rowsOut?.find((r) => !used.has(r.id) && r.event_id === want.event_id && r.position_id === want.position_id && t5(r.start_time) === want.start_time && t5(r.end_time) === want.end_time);
      if (!row) throw new Error(`Shift not saved: ${s.client} ${s.day}`);
      used.add(row.id);
      return s.names.map((n) => ({ event_id: row.event_id, staffing_row_id: row.id, user_id: idOf[n.toLowerCase()]!, mode: "direct", status: "confirmed" as const, responded_at: now, deadline: null, decline_reason: null }));
    });
    const { error: e6 } = await sb.from("invitations").insert(invites);
    fail("Staff on shifts", e6);
    return { step: "shifts" as const, done: true, workers: workerIds.length, events: evIds.length, shifts: invites.length };
  });
