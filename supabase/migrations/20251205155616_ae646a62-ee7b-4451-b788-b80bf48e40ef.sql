-- Add tipo column to sobres table to distinguish expense vs savings envelopes
ALTER TABLE public.sobres 
ADD COLUMN tipo text NOT NULL DEFAULT 'gasto' 
CHECK (tipo IN ('gasto', 'ahorro'));