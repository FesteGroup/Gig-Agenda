import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Bell, CalendarDays, Grid3x3, Users, Settings, FileSpreadsheet, Inbox, CalendarCheck, LogOut, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { cn } from "@/lib/utils";

const officeNav = [
  { to: "/home", label: "Events", icon: CalendarDays },
  { to: "/board", label: "Availability", icon: Grid3x3 },
  { to: "/staff", label: "Staff", icon: Users },
  { to: "/payroll", label: "Payroll", icon: FileSpreadsheet },
  { to: "/settings", label: "Rates", icon: Settings },
] as const;

const staffNav = [
  { to: "/home", label: "My gigs", icon: Home },
  { to: "/invitations", label: "Invitations", icon: Inbox },
  { to: "/availability", label: "Availability", icon: CalendarCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
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
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/home" className="font-display text-xl font-bold text-primary">Gig Agenda</Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary !text-foreground" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/notifications" className="relative rounded-full p-2 hover:bg-secondary" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-5 text-destructive-foreground">{unread}</span>
              )}
            </Link>
            <span className="hidden text-sm text-muted-foreground lg:inline">{me?.fullName}</span>
            <button onClick={signOut} className="rounded-full p-2 hover:bg-secondary" aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card md:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground")} activeProps={{ className: "!text-primary font-semibold" }}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
