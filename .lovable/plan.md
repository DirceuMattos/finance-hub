

## Plano: Criar a tabela `system_parameters` no banco de dados

### Problema
A tabela `system_parameters` não existe no banco de dados externo. O frontend tenta operações CRUD nela, resultando em erro.

### Solução
Criar a tabela via migração SQL e configurar as políticas RLS para usuários autenticados.

### Alterações técnicas

**1. Migração SQL — criar tabela e RLS**

```sql
CREATE TABLE IF NOT EXISTS public.system_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_key TEXT NOT NULL UNIQUE,
  parameter_value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados
CREATE POLICY "auth_select_system_parameters" ON public.system_parameters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_system_parameters" ON public.system_parameters
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_system_parameters" ON public.system_parameters
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_system_parameters" ON public.system_parameters
  FOR DELETE TO authenticated USING (true);
```

**2. Nenhuma alteração no frontend** — o código já está pronto para esta tabela.

Após a criação, será possível inserir os 9 parâmetros listados anteriormente.

