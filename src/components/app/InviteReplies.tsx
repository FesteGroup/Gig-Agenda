import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtDay, hhmm } from "@/lib/time";
import { PositionLabel } from "@/components/app/PositionLabel";
import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLE: Record<string, string> = {
  invited: "",
  accepted: "border-warning text-accent-foreground",
  confirmed: "border-success text-success",
  declined: "border-destructive text-destructive",
  cancelled: "border-destructive text-destructive",
  closed: "text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = { invited: "Waiting", accepted: "Accepted", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled", closed: "Slots filled" };

/** Invitations for upcoming events and their answers. */
export function InviteReplies({ today }: { today: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["invite-replies", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id,status,decline_reason,responded_at,user_id, profiles(full_name,photo_url), events!inner(id,day,title,client_name,account,reference,source), staffing_rows(start_time,end_time, positions(name,color))")
        .gte("events.day", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const sorted = [...data].sort((a, b) => (a.events?.day ?? "").localeCompare(b.events?.day ?? ""));
  const count = (s: string) => data.filter((i) => i.status === s).length;
  async function confirm(id: string) {
    const { error } = await supabase.from("invitations").update({ status: "confirmed" }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">Waiting {count("invited")}</Badge>
        <Badge variant="outline" className={STATUS_STYLE["accepted"]}>Accepted {count("accepted")}</Badge>
        <Badge variant="outline" className={STATUS_STYLE["confirmed"]}>Confirmed {count("confirmed")}</Badge>
        <Badge variant="outline" className={STATUS_STYLE["declined"]}>Declined {count("declined")}</Badge>
      </div>
      {!sorted.length ? (
        <p className="text-sm text-muted-foreground">No invitations for upcoming events yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs"><tr><th className="p-2">Date</th><th className="p-2">Event</th><th className="p-2">Position</th><th className="p-2">Hours</th><th className="p-2">Worker</th><th className="p-2">Answer</th><th className="p-2" /></tr></thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{fmtDay(i.events!.day)}</td>
                  <td className="p-2"><Link to="/events/$id" params={{ id: i.events!.id }} className="hover:underline">{i.events!.source === "manual" ? "M" : i.events!.account === "gingers" ? "G" : "R"}{i.events!.reference ? ` #${i.events!.reference}` : ""} · {i.events!.client_name ?? i.events!.title}</Link></td>
                  <td className="p-2"><PositionLabel name={i.staffing_rows?.positions?.name} color={i.staffing_rows?.positions?.color} /></td>
                  <td className="p-2 whitespace-nowrap">{hhmm(i.staffing_rows?.start_time)}–{hhmm(i.staffing_rows?.end_time)}</td>
                  <td className="p-2"><span className="flex items-center gap-2"><Avatar name={i.profiles?.full_name ?? "?"} url={i.profiles?.photo_url} size={24} />{i.profiles?.full_name}</span></td>
                  <td className="p-2"><Badge variant="outline" className={STATUS_STYLE[i.status]}>{STATUS_LABEL[i.status] ?? i.status}</Badge>{i.decline_reason ? <span className="ml-1 text-xs text-muted-foreground">“{i.decline_reason}”</span> : null}</td>
                  <td className="p-2 text-right">{i.status === "accepted" && <Button size="sm" variant="outline" onClick={() => confirm(i.id)}>Confirm</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

