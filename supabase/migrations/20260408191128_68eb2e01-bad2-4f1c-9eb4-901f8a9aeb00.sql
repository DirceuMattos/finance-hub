
CREATE TABLE public.investment_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.investment_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_investment_classes" ON public.investment_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_investment_classes" ON public.investment_classes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_investment_classes" ON public.investment_classes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_investment_classes" ON public.investment_classes FOR DELETE TO authenticated USING (true);
