CREATE TABLE IF NOT EXISTS public.system_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_key TEXT NOT NULL UNIQUE,
  parameter_value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_system_parameters" ON public.system_parameters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_system_parameters" ON public.system_parameters
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_system_parameters" ON public.system_parameters
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_system_parameters" ON public.system_parameters
  FOR DELETE TO authenticated USING (true);