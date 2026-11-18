import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { RELISH_STAFF_DOMAIN } from "@/lib/relish-staff-data";
import { PAST_EVENTS, XERO_EVENT_NOTES, XERO_NOTE, XERO_SHIFTS, XERO_WORKERS } from "@/lib/xero-staff-data";

/**
 * Adds all past Puree events (Relish and Gingers) to the calendar and the waiters' shifts that are
 * only in the Xero bills, so they count in everyone's worked hours. Two small steps (the host limits
 * requests per call): "events", then "shifts". Safe to run again: events are matched by Puree order,
 * a worker already on an event is not added twice, notes are not repeated.
 */
const emailOf = (key: string) => `${key}@${RELISH_STAFF_DOMAIN}`;

export const importXeroStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ step: z.enum(["events", "shifts"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: office } = await sb.rpc("is_office");
    if (!office) throw new Error("Office only");
    const fail = (m: string, e: { message: string } | null) => {
      if (e) throw new Error(`${m}: ${e.message}`);
    };

    if (data.step === "events") {
      const rows = PAST_EVENTS.map((e) => ({ source: "puree" as const, ...e }));
      const { error } = await sb.from("events").upsert(rows, { onConflict: "account,puree_id" });
      fail("Past events", error);
      return { step: "events" as const, events: rows.length };
    }

    // Positions by name.
    const { data: positions, error: pe } = await sb.from("positions").select("id,name");
    fail("Positions", pe);
    const posId = (name: string) => {
      const p = positions?.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
      if (!p) throw new Error(`Position "${name}" is missing – open Rates once, then run this again`);
      return p.id;
    };

    // Workers: existing ones by their placeholder e-mail, new ones created without a password (no e-mail sent).
    const keys = [...new Set(XERO_SHIFTS.map((s) => s.worker))];
    const { data: profs, error: e0 } = await sb.from("profiles").select("id,email").in("email", keys.map(emailOf));
    fail("Workers", e0);
    const idOf: Record<string, string> = {};
    for (const p of profs ?? []) idOf[p.email!.split("@")[0]!.toLowerCase()] = p.id;
    const missing = XERO_WORKERS.filter((w) => !idOf[w.key]);
    if (missing.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const w of missing) {
        const { data: u, error } = await supabaseAdmin.auth.admin.createUser({ email: emailOf(w.key), email_confirm: true, user_metadata: { full_name: w.name } });
        fail(w.name, error);
        idOf[w.key] = u.user!.id;
      }
      const { error } = await sb.from("profiles").upsert(
        missing.map((w) => ({ id: idOf[w.key]!, email: emailOf(w.key), full_name: w.name, main_position_id: posId(w.position), active: true })),
        { onConflict: "id" },
      );
      fail("New workers", error);
    }
    for (const k of keys) if (!idOf[k]) throw new Error(`Worker "${k}" is missing – run "Import Relish servers" first`);

    // Events of these shifts and notes.
    const pids = [...new Set([...XERO_SHIFTS, ...XERO_EVENT_NOTES].map((s) => s.puree_id))];
    const { data: evs, error: e1 } = await sb.from("events").select("id,account,puree_id,notes").in("puree_id", pids);
    fail("Events", e1);
    const evOf = (account: string, pid: string) => {
      const e = evs?.find((x) => x.account === account && x.puree_id === pid);
      if (!e) throw new Error(`Event ${pid} is missing – run step "events" first`);
      return e;
    };

    // Skip workers already on the event (e.g. added by hand or from the payment file).
    const evIds = [...new Set(XERO_SHIFTS.map((s) => evOf(s.account, s.puree_id).id))];
    const { data: have, error: e2 } = await sb.from("invitations").select("event_id,user_id").in("event_id", evIds).in("status", ["accepted", "confirmed"]);
    fail("Existing shifts", e2);
    const already = new Set((have ?? []).map((i) => `${i.event_id}|${i.user_id}`));
    const todo = XERO_SHIFTS.filter((s) => !already.has(`${evOf(s.account, s.puree_id).id}|${idOf[s.worker]}`));

    let added = 0;
    if (todo.length) {
      const rowsIn = todo.map((s) => ({ event_id: evOf(s.account, s.puree_id).id, position_id: posId(s.position), quantity: 1, start_time: s.start, end_time: s.end, break_minutes: 0 }));
      const { data: rowsOut, error: e3 } = await sb.from("staffing_rows").insert(rowsIn).select("id");
      fail("Shifts", e3);
      if ((rowsOut ?? []).length !== rowsIn.length) throw new Error("Not all shifts were saved");
      const now = new Date().toISOString();
      const { error: e4 } = await sb.from("invitations").insert(
        todo.map((s, k) => ({ event_id: rowsIn[k]!.event_id, staffing_row_id: rowsOut![k]!.id, user_id: idOf[s.worker]!, mode: "direct", status: "confirmed" as const, responded_at: now, deadline: null, decline_reason: null })),
      );
      fail("Staff on shifts", e4);
      added = todo.length;
    }

    // Notes: where each shift comes from, and agency staff.
    const notesBy = new Map<string, string[]>();
    for (const s of XERO_SHIFTS) if (s.note) notesBy.set(evOf(s.account, s.puree_id).id, [...(notesBy.get(evOf(s.account, s.puree_id).id) ?? []), `${XERO_NOTE}: ${s.note}`]);
    for (const n of XERO_EVENT_NOTES) notesBy.set(evOf(n.account, n.puree_id).id, [...(notesBy.get(evOf(n.account, n.puree_id).id) ?? []), n.note]);
    for (const [id, list] of notesBy) {
      const old = evs?.find((e) => e.id === id)?.notes ?? "";
      const add = [...new Set(list)].filter((n) => !old.includes(n));
      if (add.length) {
        const { error } = await sb.from("events").update({ notes: [old, ...add].filter(Boolean).join("\n") }).eq("id", id);
        fail("Notes", error);
      }
    }
    return { step: "shifts" as const, shifts: added, skipped: XERO_SHIFTS.length - added, newWorkers: missing.length };
  });
