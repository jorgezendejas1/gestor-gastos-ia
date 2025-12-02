-- Fix RLS INSERT policies to verify user_id matches auth.uid()

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Users with edit permission can create semanas" ON public.semanas;
DROP POLICY IF EXISTS "Users with edit permission can create movimientos" ON public.movimientos;
DROP POLICY IF EXISTS "Users with edit permission can create sobres" ON public.sobres;

-- Recreate with proper user_id verification
CREATE POLICY "Users with edit permission can create semanas" 
ON public.semanas 
FOR INSERT 
WITH CHECK (can_edit(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Users with edit permission can create movimientos" 
ON public.movimientos 
FOR INSERT 
WITH CHECK (can_edit(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Users with edit permission can create sobres" 
ON public.sobres 
FOR INSERT 
WITH CHECK (can_edit(auth.uid()) AND auth.uid() = user_id);

-- Also update metodo_pago constraint to accept both English and Spanish values
ALTER TABLE public.movimientos DROP CONSTRAINT IF EXISTS movimientos_metodo_pago_check;
ALTER TABLE public.movimientos ADD CONSTRAINT movimientos_metodo_pago_check 
CHECK (metodo_pago = ANY (ARRAY['tarjeta'::text, 'efectivo'::text, 'otro'::text, 'card'::text, 'cash'::text, 'other'::text]));