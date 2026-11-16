
create type public.app_role as enum ('office','staff');
create type public.avail_status as enum ('available','partial','unavailable');
create type public.invite_status as enum ('invited','accepted','declined','confirmed','cancelled','closed');

-- positions (public names) + rates (office only)
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#2f6b4f',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.positions to authenticated;
grant all on public.positions to service_role;
alter table public.positions enable row level security;

create table public.position_rates (
  position_id uuid primary key references public.positions(id) on delete cascade,
  hourly_cost numeric,
  client_rate numeric
);
grant select, insert, update, delete on public.position_rates to authenticated;
grant all on public.position_rates to service_role;
alter table public.position_rates enable row level security;

create table public.overtime_rates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_hour int not null,
  end_hour int,
  client_rate numeric not null,
  sort int not null default 0
);
grant select, insert, update, delete on public.overtime_rates to authenticated;
grant all on public.overtime_rates to service_role;
alter table public.overtime_rates enable row level security;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  photo_url text,
  main_position_id uuid references public.positions(id) on delete set null,
  other_position_ids uuid[] not null default '{}',
  languages text[] not null default '{}',
  personal_hourly_cost numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.staff_notes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notes text not null default ''
);
grant select, insert, update, delete on public.staff_notes to authenticated;
grant all on public.staff_notes to service_role;
alter table public.staff_notes enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_office() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'office')
$$;

-- availability
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  status avail_status not null,
  start_time time,
  end_time time,
  unique (user_id, day)
);
grant select, insert, update, delete on public.availability to authenticated;
grant all on public.availability to service_role;
alter table public.availability enable row level security;

create table public.availability_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  status avail_status not null,
  start_time time,
  end_time time,
  unique (user_id, weekday)
);
grant select, insert, update, delete on public.availability_patterns to authenticated;
grant all on public.availability_patterns to service_role;
alter table public.availability_patterns enable row level security;

-- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual' check (source in ('puree','manual')),
  account text check (account in ('relish','gingers')),
  puree_id text,
  reference text,
  title text not null default '',
  client_name text,
  contact_name text,
  day date not null,
  start_time time,
  end_time time,
  venue text,
  pax int,
  state text,
  order_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (account, puree_id)
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;

create table public.staffing_rows (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  position_id uuid not null references public.positions(id),
  quantity int not null default 1 check (quantity > 0),
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.staffing_rows to authenticated;
grant all on public.staffing_rows to service_role;
alter table public.staffing_rows enable row level security;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  staffing_row_id uuid not null references public.staffing_rows(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status invite_status not null default 'invited',
  mode text not null default 'direct' check (mode in ('direct','broadcast')),
  deadline timestamptz,
  decline_reason text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (staffing_row_id, user_id)
);
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

-- helper: is the caller on this event (any non-terminal invitation)
create or replace function public.on_event(_event uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.invitations where event_id = _event and user_id = auth.uid())
$$;

-- POLICIES
create policy "read positions" on public.positions for select to authenticated using (true);
create policy "office writes positions" on public.positions for all to authenticated using (public.is_office()) with check (public.is_office());
create policy "office rates" on public.position_rates for all to authenticated using (public.is_office()) with check (public.is_office());
create policy "office overtime" on public.overtime_rates for all to authenticated using (public.is_office()) with check (public.is_office());

create policy "own or office read profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_office());
create policy "own or office update profile" on public.profiles for update to authenticated using (id = auth.uid() or public.is_office()) with check (id = auth.uid() or public.is_office());
create policy "office insert profile" on public.profiles for insert to authenticated with check (public.is_office() or id = auth.uid());
create policy "office delete profile" on public.profiles for delete to authenticated using (public.is_office());

create policy "office notes" on public.staff_notes for all to authenticated using (public.is_office()) with check (public.is_office());

create policy "own or office read roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_office());
create policy "office grants roles" on public.user_roles for insert to authenticated with check (public.is_office());
create policy "office revokes roles" on public.user_roles for delete to authenticated using (public.is_office());

create policy "own or office availability" on public.availability for all to authenticated using (user_id = auth.uid() or public.is_office()) with check (user_id = auth.uid() or public.is_office());
create policy "own or office patterns" on public.availability_patterns for all to authenticated using (user_id = auth.uid() or public.is_office()) with check (user_id = auth.uid() or public.is_office());

create policy "office events" on public.events for all to authenticated using (public.is_office()) with check (public.is_office());
create policy "staff read own events" on public.events for select to authenticated using (public.on_event(id));

create policy "office rows" on public.staffing_rows for all to authenticated using (public.is_office()) with check (public.is_office());
create policy "staff read own rows" on public.staffing_rows for select to authenticated using (public.on_event(event_id));

create policy "office invitations" on public.invitations for all to authenticated using (public.is_office()) with check (public.is_office());
create policy "staff read own invitations" on public.invitations for select to authenticated using (user_id = auth.uid());

create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- prevent staff self-escalating sensitive profile fields
create or replace function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_office() then
    new.personal_hourly_cost := old.personal_hourly_cost;
    new.active := old.active;
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles for each row execute function public.guard_profile_update();

-- signup: profile + role (office only for verified company emails)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, photo_url)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'staff') on conflict do nothing;
  if new.email_confirmed_at is not null and lower(split_part(new.email,'@',2)) in ('relish.com.hk','feste-group.com') then
    insert into public.user_roles (user_id, role) values (new.id, 'office') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_user_confirmed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(split_part(new.email,'@',2)) in ('relish.com.hk','feste-group.com') then
    insert into public.user_roles (user_id, role) values (new.id, 'office') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- notify helpers
create or replace function public.notify_office(_title text, _body text, _link text) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, link)
  select ur.user_id, _title, _body, _link from public.user_roles ur where ur.role = 'office';
$$;

create or replace function public.on_invitation_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare e record; p text;
begin
  select * into e from public.events where id = new.event_id;
  select pos.name into p from public.staffing_rows r join public.positions pos on pos.id = r.position_id where r.id = new.staffing_row_id;
  insert into public.notifications (user_id, title, body, link)
  values (new.user_id, 'New gig invitation', p || ' · ' || coalesce(e.title,'Event') || ' · ' || to_char(e.day,'Dy DD Mon'), '/invitations');
  return new;
end $$;
create trigger invitation_insert after insert on public.invitations for each row execute function public.on_invitation_insert();

-- staff reply RPC
create or replace function public.respond_invitation(_id uuid, _accept boolean, _reason text default null)
returns invite_status language plpgsql security definer set search_path = public as $$
declare inv record; r record; e record; taken int; who text; pos text; new_status invite_status;
begin
  select * into inv from public.invitations where id = _id and user_id = auth.uid() for update;
  if not found then raise exception 'Invitation not found'; end if;
  select * into r from public.staffing_rows where id = inv.staffing_row_id;
  select * into e from public.events where id = inv.event_id;
  select full_name into who from public.profiles where id = auth.uid();
  select name into pos from public.positions where id = r.position_id;

  if _accept then
    if inv.status <> 'invited' then raise exception 'This invitation is no longer open'; end if;
    if inv.deadline is not null and inv.deadline < now() then raise exception 'The reply deadline has passed'; end if;
    select count(*) into taken from public.invitations where staffing_row_id = r.id and status in ('accepted','confirmed');
    if taken >= r.quantity then
      update public.invitations set status = 'closed' where id = _id;
      raise exception 'Sorry, all slots are already filled';
    end if;
    update public.invitations set status = 'accepted', responded_at = now(), decline_reason = null where id = _id;
    new_status := 'accepted';
    perform public.notify_office(coalesce(who,'Staff') || ' accepted', pos || ' · ' || e.title || ' · ' || to_char(e.day,'Dy DD Mon'), '/events/' || e.id);
    if taken + 1 >= r.quantity then
      update public.invitations set status = 'closed' where staffing_row_id = r.id and status = 'invited';
    end if;
  else
    if inv.status in ('accepted','confirmed') then
      update public.invitations set status = 'cancelled', responded_at = now(), decline_reason = _reason where id = _id;
      new_status := 'cancelled';
      perform public.notify_office('⚠ ' || coalesce(who,'Staff') || ' cancelled', pos || ' · ' || e.title || ' · ' || to_char(e.day,'Dy DD Mon') || coalesce(' — ' || _reason,'') || '. Slot reopened.', '/events/' || e.id);
    elsif inv.status = 'invited' then
      update public.invitations set status = 'declined', responded_at = now(), decline_reason = _reason where id = _id;
      new_status := 'declined';
      perform public.notify_office(coalesce(who,'Staff') || ' declined', pos || ' · ' || e.title || coalesce(' — ' || _reason,''), '/events/' || e.id);
    else
      raise exception 'This invitation is no longer open';
    end if;
  end if;
  return new_status;
end $$;
grant execute on function public.respond_invitation(uuid, boolean, text) to authenticated;

-- team for an event (names/positions only), for confirmed staff or office
create or replace function public.event_team(_event uuid)
returns table (user_id uuid, full_name text, photo_url text, position_name text, start_time time, end_time time, status invite_status)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.photo_url, pos.name, r.start_time, r.end_time, i.status
  from public.invitations i
  join public.profiles p on p.id = i.user_id
  join public.staffing_rows r on r.id = i.staffing_row_id
  join public.positions pos on pos.id = r.position_id
  where i.event_id = _event and i.status = 'confirmed'
    and (public.is_office() or exists (select 1 from public.invitations me where me.event_id = _event and me.user_id = auth.uid() and me.status = 'confirmed'))
  order by pos.name, p.full_name
$$;
grant execute on function public.event_team(uuid) to authenticated;

-- my hourly rate for a position
create or replace function public.my_rate(_position uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select personal_hourly_cost from public.profiles where id = auth.uid()), (select hourly_cost from public.position_rates where position_id = _position))
$$;
grant execute on function public.my_rate(uuid) to authenticated;

-- seed
insert into public.positions (name, color, sort) values
 ('Chef','#b4532a',1),('Sous Chef','#c9802f',2),('Bartender','#6a4c93',3),('Server','#2f6b4f',4),('Event Manager','#1f4e79',5),('Kitchen Porter','#6b6b6b',6);
insert into public.position_rates (position_id, client_rate) select id, case when name='Server' then 190 else null end from public.positions;
insert into public.overtime_rates (label, start_hour, end_hour, client_rate, sort) values
 ('Midnight – 1 am',0,1,290,1),('1 – 2 am',1,2,395,2),('2 – 3 am',2,3,625,3),('From 3 am',3,null,1200,4);
