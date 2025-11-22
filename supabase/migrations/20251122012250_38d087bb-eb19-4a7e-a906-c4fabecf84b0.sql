-- Tabla de semanas para agrupar movimientos
CREATE TABLE public.semanas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  saldo_inicial DECIMAL(10, 2) DEFAULT 0,
  ingresos_totales DECIMAL(10, 2) DEFAULT 0,
  gastos_totales DECIMAL(10, 2) DEFAULT 0,
  saldo_final DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, fecha_inicio)
);

-- Tabla de movimientos (transacciones)
CREATE TABLE public.movimientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  categoria TEXT,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('tarjeta', 'efectivo', 'otro')),
  semana_id UUID REFERENCES public.semanas(id) ON DELETE SET NULL,
  fuente_texto TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de sobres (presupuestos)
CREATE TABLE public.sobres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  mensual DECIMAL(10, 2) NOT NULL,
  semanal_calculado DECIMAL(10, 2) NOT NULL,
  gastado_semana DECIMAL(10, 2) DEFAULT 0,
  restante_semana DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, nombre)
);

-- Índices para mejor rendimiento
CREATE INDEX idx_movimientos_user_fecha ON public.movimientos(user_id, fecha DESC);
CREATE INDEX idx_movimientos_semana ON public.movimientos(semana_id);
CREATE INDEX idx_semanas_user_fecha ON public.semanas(user_id, fecha_inicio DESC);
CREATE INDEX idx_sobres_user ON public.sobres(user_id);

-- Enable Row Level Security
ALTER TABLE public.semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sobres ENABLE ROW LEVEL SECURITY;

-- RLS Policies para semanas
CREATE POLICY "Users can view their own semanas"
ON public.semanas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own semanas"
ON public.semanas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own semanas"
ON public.semanas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own semanas"
ON public.semanas FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies para movimientos
CREATE POLICY "Users can view their own movimientos"
ON public.movimientos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own movimientos"
ON public.movimientos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own movimientos"
ON public.movimientos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own movimientos"
ON public.movimientos FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies para sobres
CREATE POLICY "Users can view their own sobres"
ON public.sobres FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sobres"
ON public.sobres FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sobres"
ON public.sobres FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sobres"
ON public.sobres FOR DELETE
USING (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_semanas_updated_at
  BEFORE UPDATE ON public.semanas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_movimientos_updated_at
  BEFORE UPDATE ON public.movimientos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sobres_updated_at
  BEFORE UPDATE ON public.sobres
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();