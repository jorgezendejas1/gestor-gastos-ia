-- Create table for learned category mappings
CREATE TABLE public.categoria_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  descripcion_pattern TEXT NOT NULL,
  categoria TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categoria_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own mappings" 
ON public.categoria_mappings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mappings" 
ON public.categoria_mappings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mappings" 
ON public.categoria_mappings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mappings" 
ON public.categoria_mappings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_categoria_mappings_updated_at
BEFORE UPDATE ON public.categoria_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();