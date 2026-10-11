-- =====================================================================
-- PG FOOD DISTRIBUTION SYSTEM — SIMPLE FOOD TALLY SCHEMA & SEED DATA
-- Simple and intuitive: students click "Taken", see who has taken least food,
-- and see total food taken tally for all students.
-- =====================================================================

-- ==========================================
-- STEP 1: CLEAN SLATE
-- ==========================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

DROP TABLE IF EXISTS public.food_requests CASCADE;
DROP TABLE IF EXISTS public.food_events CASCADE;
DROP TABLE IF EXISTS public.round_members CASCADE;
DROP TABLE IF EXISTS public.rounds CASCADE;
DROP TABLE IF EXISTS public.monthly_cycles CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.pg_groups CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==========================================
-- STEP 2: EXTENSIONS
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- STEP 3: TABLES
-- ==========================================

-- 1. profiles
CREATE TABLE public.profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  avatar_url     TEXT,
  role           TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'ADMIN')),
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. pg_groups
CREATE TABLE public.pg_groups (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. group_members
CREATE TABLE public.group_members (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id  UUID NOT NULL REFERENCES public.pg_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  active    BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at   TIMESTAMPTZ,
  UNIQUE(group_id, user_id)
);

-- 4. food_events (records each time a student takes food)
CREATE TABLE public.food_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID NOT NULL REFERENCES public.pg_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action     TEXT NOT NULL DEFAULT 'TAKEN',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- 5. food_requests (requires 2 peer approvals before a food pickup is recorded)
CREATE TABLE public.food_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES public.pg_groups(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approvals   UUID[] NOT NULL DEFAULT '{}',
  rejections  UUID[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- ==========================================
-- STEP 4: ROW LEVEL SECURITY & POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pg_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (id = auth.uid() OR is_admin());

-- pg_groups
CREATE POLICY "pg_groups_select" ON public.pg_groups FOR SELECT USING (true);
CREATE POLICY "pg_groups_all_admin" ON public.pg_groups FOR ALL USING (is_admin());

-- group_members
CREATE POLICY "gm_select" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "gm_insert" ON public.group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "gm_all_admin" ON public.group_members FOR ALL USING (is_admin());

-- food_events
CREATE POLICY "fe_select" ON public.food_events FOR SELECT USING (true);
CREATE POLICY "fe_insert" ON public.food_events FOR INSERT WITH CHECK (true);
CREATE POLICY "fe_all_admin" ON public.food_events FOR ALL USING (is_admin());

-- food_requests
CREATE POLICY "fr_select" ON public.food_requests FOR SELECT USING (true);
CREATE POLICY "fr_insert" ON public.food_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "fr_update" ON public.food_requests FOR UPDATE USING (true);

-- ==========================================
-- STEP 5: TRIGGER — auto-create profile and link to PG group
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Insert/update profile
  INSERT INTO public.profiles (id, name, email, avatar_url, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'STUDENT',
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW();

  -- Automatically link to default PG group
  SELECT id INTO v_group_id FROM public.pg_groups ORDER BY created_at ASC LIMIT 1;
  IF v_group_id IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, active)
    VALUES (v_group_id, NEW.id, true)
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- STEP 6: REALTIME
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.profiles,
  public.group_members,
  public.food_events,
  public.food_requests;

-- ==========================================
-- STEP 7: DEFAULT PG GROUP (Required for new signups)
-- ==========================================

INSERT INTO public.pg_groups (id, name, created_at)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Skyline PG', NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- COMPLETE ✓
-- =====================================================================
