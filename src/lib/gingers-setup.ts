import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GINGERS_POSITIONS, OLD_GINGERS_COLORS } from "./gingers";

let done = false;

/**
 * Adds the Gingers positions (with their Puree hourly cost and client rate) once, when an office user
 * opens the app. Existing positions and rates are never overwritten, so later edits in Settings stay.
 */
export function useEnsureGingersPositions(canOffice: boolean | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!canOffice || done) return;
    done = true;
    (async () => {
      const { data: existing, error } = await supabase.from("positions").select("id,name,color");
      if (error || !existing) return;
      // Gingers positions still in the old gold shades get their own colours (colours picked later stay).
      for (const p of existing) {
        const d = GINGERS_POSITIONS.find((g) => g.name.toLowerCase() === p.name.toLowerCase());
        if (d && OLD_GINGERS_COLORS.includes((p.color ?? "").toLowerCase()) && p.color !== d.color) {
          await supabase.from("positions").update({ color: d.color }).eq("id", p.id);
          qc.invalidateQueries({ queryKey: ["positions"] });
          qc.invalidateQueries({ queryKey: ["settings"] });
        }
      }
      const have = new Set(existing.map((p) => p.name.toLowerCase()));
      const missing = GINGERS_POSITIONS.filter((p) => !have.has(p.name.toLowerCase()));
      if (!missing.length) return;
      const { data: created, error: e2 } = await supabase
        .from("positions")
        .insert(missing.map((p) => ({ name: p.name, color: p.color, sort: p.sort })))
        .select("id,name");
      if (e2 || !created) return;
      await supabase.from("position_rates").upsert(
        created.map((c) => {
          const d = missing.find((m) => m.name === c.name)!;
          return { position_id: c.id, hourly_cost: d.hourlyCost, client_rate: d.clientRate };
        }),
      );
      for (const k of ["positions", "rates", "settings"]) qc.invalidateQueries({ queryKey: [k] });
    })();
  }, [canOffice, qc]);
}
