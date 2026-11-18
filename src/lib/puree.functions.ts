import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

const jwtOf = () => (getRequest()?.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || undefined;

export const syncPuree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: office } = await supabase.rpc("is_office");
    if (!office) throw new Error("Office only");
    const p = await import("./puree.server");
    const warnings: string[] = [];
    let synced = 0;
    let fromCopy: string | null = null;

    // When Puree can't be read live, use the Calendar app's copy of the Puree orders (refreshed daily).
    async function useCopy(account: "relish" | "gingers") {
      const { PUREE_COPY, PUREE_COPY_AT } = await import("./puree-copy.server");
      const rows = PUREE_COPY.filter((r) => r.account === account && r.day >= data.from && r.day <= data.to).map((r) => ({ source: "puree" as const, ...r }));
      if (rows.length) {
        const { error } = await supabase.from("events").upsert(rows, { onConflict: "account,puree_id" });
        if (error) throw new Error(error.message);
        synced += rows.length;
      }
      fromCopy = PUREE_COPY_AT;
    }

    for (const account of ["relish", "gingers"] as const) {
      const token = p.tokenFor(account, jwtOf());
      if (!token) {
        await useCopy(account);
        continue;
      }
      try {
        const orders = await p.listOrders(token, data.from, data.to);
        const rows = orders
          .filter((o) => !p.HIDDEN_STATES.includes(String(o.state ?? "").toLowerCase()))
          .map((o) => p.mapOrder(o, account))
          .filter((r) => r.day);
        if (rows.length) {
          const { error } = await supabase.from("events").upsert(rows, { onConflict: "account,puree_id" });
          if (error) throw new Error(error.message);
          synced += rows.length;
        }
        // Remove cached events Puree now reports as declined/expired, unless staffed.
        const hidden = orders.filter((o) => p.HIDDEN_STATES.includes(String(o.state ?? "").toLowerCase())).map((o) => String(o.id));
        if (hidden.length) {
          await supabase.from("events").update({ state: "declined" }).eq("account", account).in("puree_id", hidden);
        }
        // Fill venue/end time from order details for events missing them (rate-limit friendly).
        const { data: missing } = await supabase
          .from("events")
          .select("id,puree_id")
          .eq("account", account)
          .is("venue", null)
          .gte("day", data.from)
          .lte("day", data.to)
          .limit(15);
        for (const m of missing ?? []) {
          try {
            const d = await p.getOrder(token, m.puree_id!);
            const venue = p.venueOf(d) ?? "";
            await supabase.from("events").update({ venue }).eq("id", m.id);
          } catch {
            /* skip one order */
          }
        }
      } catch {
        // Live Puree not reachable (e.g. Calendar app not shared): fall back to the copy.
        try {
          await useCopy(account);
        } catch (e2) {
          warnings.push(`${account}: ${(e2 as Error).message}`);
        }
      }
    }
    return { synced, warnings, fromCopy: fromCopy as string | null };
  });

export const getOrderDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: office } = await supabase.rpc("is_office");
    if (!office) throw new Error("Office only");
    const { data: ev } = await supabase.from("events").select("*").eq("id", data.eventId).single();
    if (!ev || ev.source !== "puree" || !ev.puree_id || !ev.account) return null;
    const p = await import("./puree.server");
    const token = p.tokenFor(ev.account as "relish" | "gingers", jwtOf());
    if (!token) return null;
    const d = await p.getOrder(token, ev.puree_id);
    const live = p.mapOrder(d, ev.account as "relish" | "gingers");
    const venue = p.venueOf(d);
    const deliveries = (d.deliveries ?? []).map((x) => p.toHkTime(x.delivery_time)).filter(Boolean) as string[];
    const items = ((d as { order_items?: { name?: string; quantity?: number }[] }).order_items ?? []).map((i) => ({ name: i.name ?? "", quantity: i.quantity ?? null }));
    await supabase.from("events").update({ ...live, venue: venue ?? ev.venue }).eq("id", ev.id);
    return { venue, deliveries, items };
  });
