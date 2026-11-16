
create trigger invitation_reinvite after update of status on public.invitations for each row
  when (new.status = 'invited' and old.status <> 'invited')
  execute function public.on_invitation_insert();

-- notify staff when office confirms or cancels them
create or replace function public.on_invitation_office_change() returns trigger language plpgsql security definer set search_path = public as $$
declare e record;
begin
  if public.is_office() and new.status in ('confirmed','cancelled') and old.status <> new.status then
    select * into e from public.events where id = new.event_id;
    insert into public.notifications (user_id, title, body, link)
    values (new.user_id, case when new.status = 'confirmed' then 'You are confirmed' else 'Gig cancelled' end,
            coalesce(e.title,'Event') || ' · ' || to_char(e.day,'Dy DD Mon'), '/home');
  end if;
  return new;
end $$;
create trigger invitation_office_change after update of status on public.invitations for each row execute function public.on_invitation_office_change();

alter publication supabase_realtime add table public.notifications;
