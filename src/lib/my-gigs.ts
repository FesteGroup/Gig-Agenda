import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shiftsClash } from "@/lib/time";

export function useMyInvitations(userId?: string) {
  return useQuery({
    queryKey: ["my-invitations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select(
          "*, events(id,title,client_name,day,start_time,venue,account), staffing_rows(position_id,start_time,end_time,break_minutes, positions(name,color))",
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const positionIds = [
        ...new Set((data ?? []).map((i) => i.staffing_rows?.position_id).filter(Boolean)),
      ] as string[];
      const rates: Record<string, number | null> = {};
      await Promise.all(
        positionIds.map(async (pid) => {
          const { data: r } = await supabase.rpc("my_rate", { _position: pid });
          rates[pid] = r ?? null;
        }),
      );
      return (data ?? []).map((i) => ({
        ...i,
        rate: i.staffing_rows ? (rates[i.staffing_rows.position_id] ?? null) : null,
      }));
    },
  });
}
export type MyInvitation = NonNullable<ReturnType<typeof useMyInvitations>["data"]>[number];

/** The worker's accepted or confirmed gig that overlaps this invitation's time (other events only). */
export function clashingGig(inv: MyInvitation, all: MyInvitation[]): MyInvitation | null {
  const e = inv.events,
    r = inv.staffing_rows;
  if (!e || !r) return null;
  return (
    all.find(
      (o) =>
        o.id !== inv.id &&
        o.staffing_row_id !== inv.staffing_row_id &&
        (o.status === "accepted" || o.status === "confirmed") &&
        !!o.events &&
        !!o.staffing_rows &&
        shiftsClash(
          { day: e.day, start: r.start_time, end: r.end_time },
          { day: o.events.day, start: o.staffing_rows.start_time, end: o.staffing_rows.end_time },
        ),
    ) ?? null
  );
}
