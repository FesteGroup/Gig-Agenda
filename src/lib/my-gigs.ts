import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyInvitations(userId?: string) {
  return useQuery({
    queryKey: ["my-invitations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, events(id,title,client_name,day,start_time,venue,account), staffing_rows(position_id,start_time,end_time,break_minutes, positions(name,color))")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const positionIds = [...new Set((data ?? []).map((i) => i.staffing_rows?.position_id).filter(Boolean))] as string[];
      const rates: Record<string, number | null> = {};
      await Promise.all(
        positionIds.map(async (pid) => {
          const { data: r } = await supabase.rpc("my_rate", { _position: pid });
          rates[pid] = r ?? null;
        }),
      );
      return (data ?? []).map((i) => ({ ...i, rate: i.staffing_rows ? rates[i.staffing_rows.position_id] ?? null : null }));
    },
  });
}
export type MyInvitation = NonNullable<ReturnType<typeof useMyInvitations>["data"]>[number];
