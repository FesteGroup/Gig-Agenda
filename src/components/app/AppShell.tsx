import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Bell, CalendarDays, Grid3x3, Users, Settings, FileSpreadsheet, Inbox, CalendarCheck, LogOut, Home, UserCircle, Send, Briefcase, Utensils, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setView, useMe } from "@/lib/me";
import { useEnsureGingersPositions } from "@/lib/gingers-setup";
import { cn } from "@/lib/utils";

// Each section has its own colour (icon chip in the header, icon in the mobile bar).
const officeNav = [
  { to: "/home", label: "Events", icon: CalendarDays, colour: "bg-coral", text: "text-coral" },
  { to: "/board", label: "Availability", icon: Grid3x3, colour: "bg-sky", text: "text-sky" },
  { to: "/staff", label: "Staff", icon: Users, colour: "bg-violet", text: "text-violet" },
  { to: "/payroll", label: "Reports", icon: FileSpreadsheet, colour: "bg-sun", text: "text-sun" },
  { to: "/expenses", label: "Expenses", icon: Receipt, colour: "bg-rose", text: "text-rose" },
  { to: "/demo", label: "Demo", icon: Send, colour: "bg-teal", text: "text-teal" },
  { to: "/settings", label: "Rates", icon: Settings, colour: "bg-success", text: "text-success" },
] as const;

const staffNav = [
  { to: "/home", label: "My gigs", icon: Home, colour: "bg-coral", text: "text-coral" },
  { to: "/invitations", label: "Invitations", icon: Inbox, colour: "bg-violet", text: "text-violet" },
  { to: "/availability", label: "Availability", icon: CalendarCheck, colour: "bg-sky", text: "text-sky" },
  { to: "/expenses", label: "Expenses", icon: Receipt, colour: "bg-rose", text: "text-rose" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  useEnsureGingersPositions(me?.canOffice);
  const navigate = useNavigate();
  const nav = me?.isOffice ? officeNav : staffNav;

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", me?.id],
    enabled: !!me,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`notif-${me.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["unread"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["my-invitations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, qc]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[oklch(0.36_0.09_165)] via-[oklch(0.45_0.11_175)] to-[oklch(0.5_0.1_200)] text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/home" className="flex items-center gap-2 font-display text-xl font-bold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sun text-sm text-amber-950 shadow">G</span>
            Gig Agenda
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white" activeProps={{ className: "!bg-white !text-foreground shadow" }}>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-white", n.colour)}>
                  <n.icon className="h-3 w-3" />
                </span>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {me?.canOffice && (
              <div className="mr-1 flex rounded-full border border-white/30 bg-white/10 p-0.5 text-xs font-medium" role="group" aria-label="Switch view">
                <button
                  onClick={() => { setView("office"); navigate({ to: "/home" }); }}
                  className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", me.view === "office" ? "bg-sun text-amber-950 shadow" : "text-white/80 hover:bg-white/15")}
                  aria-pressed={me.view === "office"}
                >
                  <Briefcase className="h-3.5 w-3.5" />Office
                </button>
                <button
                  onClick={() => { setView("staff"); navigate({ to: "/home" }); }}
                  className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", me.view === "staff" ? "bg-sun text-amber-950 shadow" : "text-white/80 hover:bg-white/15")}
                  aria-pressed={me.view === "staff"}
                >
                  <Utensils className="h-3.5 w-3.5" />Staff
                </button>
              </div>
            )}
            <Link to="/notifications" className="relative rounded-full p-2 hover:bg-white/15" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-coral px-1 ring-2 ring-white text-center text-[11px] font-bold leading-5 text-destructive-foreground">{unread}</span>
              )}
            </Link>
            {me && (
              <Link to="/staff/$id" params={{ id: me.id }} className="rounded-full p-1 hover:bg-white/15" aria-label="My profile">
                <UserCircle className="h-6 w-6" />
              </Link>
            )}
            <button onClick={signOut} className="rounded-full p-2 hover:bg-white/15" aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card md:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground")} activeProps={{ className: "!text-foreground font-semibold" }}>
            <n.icon className={cn("h-5 w-5", n.text)} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
