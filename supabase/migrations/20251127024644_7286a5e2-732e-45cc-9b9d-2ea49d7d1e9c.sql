-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'editor',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to check if user can edit (admin or editor)
CREATE OR REPLACE FUNCTION public.can_edit(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'editor')
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Update movimientos policies to respect roles
DROP POLICY IF EXISTS "Users can update their own movimientos" ON public.movimientos;
DROP POLICY IF EXISTS "Users can delete their own movimientos" ON public.movimientos;
DROP POLICY IF EXISTS "Users can create their own movimientos" ON public.movimientos;

CREATE POLICY "Users with edit permission can create movimientos"
ON public.movimientos
FOR INSERT
TO authenticated
WITH CHECK (public.can_edit(auth.uid()));

CREATE POLICY "Users with edit permission can update movimientos"
ON public.movimientos
FOR UPDATE
TO authenticated
USING (public.can_edit(auth.uid()));

CREATE POLICY "Admins can delete movimientos"
ON public.movimientos
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Update semanas policies
DROP POLICY IF EXISTS "Users can update their own semanas" ON public.semanas;
DROP POLICY IF EXISTS "Users can delete their own semanas" ON public.semanas;
DROP POLICY IF EXISTS "Users can create their own semanas" ON public.semanas;

CREATE POLICY "Users with edit permission can create semanas"
ON public.semanas
FOR INSERT
TO authenticated
WITH CHECK (public.can_edit(auth.uid()));

CREATE POLICY "Users with edit permission can update semanas"
ON public.semanas
FOR UPDATE
TO authenticated
USING (public.can_edit(auth.uid()));

CREATE POLICY "Admins can delete semanas"
ON public.semanas
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Update sobres policies
DROP POLICY IF EXISTS "Users can update their own sobres" ON public.sobres;
DROP POLICY IF EXISTS "Users can delete their own sobres" ON public.sobres;
DROP POLICY IF EXISTS "Users can create their own sobres" ON public.sobres;

CREATE POLICY "Users with edit permission can create sobres"
ON public.sobres
FOR INSERT
TO authenticated
WITH CHECK (public.can_edit(auth.uid()));

CREATE POLICY "Users with edit permission can update sobres"
ON public.sobres
FOR UPDATE
TO authenticated
USING (public.can_edit(auth.uid()));

CREATE POLICY "Admins can delete sobres"
ON public.sobres
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Enable realtime for semanas and sobres
ALTER PUBLICATION supabase_realtime ADD TABLE public.semanas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sobres;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;

-- Trigger to auto-assign admin role to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    -- First user becomes admin
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (NEW.id, 'admin', NEW.id);
  ELSE
    -- Subsequent users become editors by default
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'editor');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();