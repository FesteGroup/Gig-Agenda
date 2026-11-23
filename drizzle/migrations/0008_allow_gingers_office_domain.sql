CREATE OR REPLACE FUNCTION public.office_signup_allowed(_email text, _staff_only boolean) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NOT coalesce(_staff_only, true) AND lower(split_part(coalesce(_email, ''), '@', 2)) IN ('relish.com', 'relish.com.hk', 'feste-group.com', 'gingers.com.hk')
$$;