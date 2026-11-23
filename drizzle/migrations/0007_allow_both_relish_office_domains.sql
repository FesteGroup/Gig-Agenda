CREATE OR REPLACE FUNCTION public.office_signup_allowed(_email text, _staff_only boolean) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NOT coalesce(_staff_only, true) AND lower(split_part(coalesce(_email, ''), '@', 2)) IN ('relish.com', 'relish.com.hk', 'feste-group.com')
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, photo_url)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'staff') ON CONFLICT DO NOTHING;
  IF new.email_confirmed_at IS NOT NULL AND public.office_signup_allowed(new.email, false) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'office') ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END $$;
CREATE OR REPLACE FUNCTION public.handle_user_confirmed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'staff') ON CONFLICT DO NOTHING;
  IF public.office_signup_allowed(new.email, false) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'office') ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END $$;
COMMENT ON TABLE public.office_access_exclusions IS 'DEPRECATED: automatic office access follows verified company email domains; exclusions are not used by signup or confirmation.';