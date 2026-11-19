import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { importRelishStaff } from "./import.functions";
import { importXeroStaff } from "./xero-import.functions";
import { XERO_IMPORT_AT } from "./xero-staff-data";

const KEY = "gig-agenda:auto-import";
let running = false;

/**
 * Brings in the past events and the staff who worked them (Relish servers' payment file + Xero bills)
 * automatically, once per browser and data version, when an office user opens the app. Both imports are
 * safe to run again; the Staff page buttons stay for a manual re-run.
 */
export function useAutoImport(canOffice: boolean | undefined) {
  const qc = useQueryClient();
  const relish = useServerFn(importRelishStaff);
  const xero = useServerFn(importXeroStaff);
  useEffect(() => {
    if (!canOffice || running || typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY) === XERO_IMPORT_AT) return;
    running = true;
    (async () => {
      try {
        // Wait for the Gingers positions (added when the app opens).
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.from("positions").select("name").ilike("name", "Gingers%");
          if ((data ?? []).length) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).like("email", "%@staff.relish.com.hk");
        if (!count) {
          let offset = 0;
          for (;;) {
            const w = await relish({ data: { step: "workers", offset } });
            if (w.step !== "workers" || w.done) break;
            offset = w.next;
          }
          await relish({ data: { step: "shifts", offset: 0 } });
        }
        await xero({ data: { step: "events" } });
        const b = await xero({ data: { step: "shifts" } });
        window.localStorage.setItem(KEY, XERO_IMPORT_AT);
        if (b.step === "shifts" && b.shifts) toast.success(`${b.shifts} past shifts from Xero added to the events`);
        await qc.invalidateQueries();
      } catch (e) {
        toast.error(`Past shifts not imported: ${(e as Error).message}`);
      } finally {
        running = false;
      }
    })();
  }, [canOffice, qc, relish, xero]);
}
