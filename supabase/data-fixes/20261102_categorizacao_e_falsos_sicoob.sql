-- 02/11/2026 — aprovado pelo Dirceu:
-- (1) cancela 6 lançamentos falsos da importação do extrato Sicoob - PJ em PDF (quadro de informações do
--     contrato lido como lançamento, data 27/10/2026); mantém os 2 DÉB.IOF, que são reais;
-- (2) cria a categoria "Transferências entre contas";
-- (3) categoriza lançamentos sem categoria pelo histórico (aplicativos -> Equipamentos; streaming -> Lazer);
-- (4) recalcula os saldos das contas.
-- Guarda o estado anterior em archive.categorizacao_20261102 para o rollback.
-- Rollback: 20261102_categorizacao_e_falsos_sicoob.rollback.sql
BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;
CREATE TABLE IF NOT EXISTS archive.categorizacao_20261102 (
  id uuid PRIMARY KEY, category_id uuid, status text, acao text, saved_at timestamptz DEFAULT now()
);

-- (1) Falsos do extrato Sicoob - PJ
INSERT INTO archive.categorizacao_20261102 (id, category_id, status, acao)
SELECT t.id, t.category_id, t.status, 'cancelar_falso'
  FROM public.transactions t JOIN public.accounts a ON a.id = t.account_id
 WHERE a.name = 'Sicoob - PJ' AND t.status <> 'cancelled' AND t.category_id IS NULL
   AND coalesce(t.due_date, t.competence_date) = '2026-10-27'
   AND (t.description ILIKE 'CAPITAL DE GIRO:%' OR t.description ILIKE 'PARCELA M%XIMA DISPON%'
        OR t.description ILIKE '(+) CHEQUE ESPECIAL CONTRATADO%' OR t.description ILIKE 'CUSTO EFETIVO TOTAL%'
        OR t.description ILIKE 'TAXA CHEQUE ESPECIAL EMPRESARIAL%')
ON CONFLICT (id) DO NOTHING;

UPDATE public.transactions t SET status = 'cancelled'
  FROM archive.categorizacao_20261102 x
 WHERE x.id = t.id AND x.acao = 'cancelar_falso';

-- (2) Categoria de transferências entre contas próprias
INSERT INTO public.categories (name, transaction_nature, is_active)
SELECT 'Transferências entre contas', 'mixed', true
 WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Transferências entre contas');

-- (3) Categorização pelo histórico (só lançamentos sem categoria e não cancelados)
DROP TABLE IF EXISTS archive.regras_20261102;
CREATE TABLE archive.regras_20261102 (pat text, cat text); -- tabela comum: o editor do Supabase não mantém tabela temporária
INSERT INTO archive.regras_20261102 VALUES
  ('Parcelas Empréstimo Sicoob%', 'Empréstimos'),
  ('DÉB.EMPRÉSTIMO%', 'Empréstimos'),
  ('SUPERMERCADO%', 'Supermercados - Frutarias'),
  ('LAZER%', 'Lazer'), ('VINHOS%', 'Lazer'), ('PS5%', 'Lazer'), ('STREAM%', 'Lazer'),
  ('VESTUÁRIO%', 'Vestuário'),
  ('AUTOMÓVEL - COMBUSTÍVEL%', 'Combustível'),
  ('EQUIPAMENTOS ESCRITÓRIO%', 'Equipamentos - Aplicativos e Outros Recursos'),
  ('APLICATIVOS%', 'Equipamentos - Aplicativos e Outros Recursos'),
  ('CLOUD - APPLE%', 'Equipamentos - Aplicativos e Outros Recursos'),
  ('ARMAZENAMENTO DE DADOS%', 'Equipamentos - Aplicativos e Outros Recursos'),
  ('APPLE.COM/BILL%', 'Equipamentos - Aplicativos e Outros Recursos'),
  ('ARMÁRIO ESCOLA%', 'Educação'), ('MATERIAL ESCOLAR%', 'Educação'),
  ('REFORMA%', 'Residência - Despesas Gerais'), ('COMPRAS PARA CASA%', 'Residência - Despesas Gerais'),
  ('ITAU SEG VIDA%', 'Seguros'),
  ('JUROS LIMITE%', 'Despesas Bancárias'), ('JUROS CTA GARANTIDA%', 'Despesas Bancárias'),
  ('DEB PACOTE SERVI%', 'Despesas Bancárias'), ('SEGURO LIS%', 'Despesas Bancárias'), ('DÉB.IOF%', 'Despesas Bancárias'),
  ('CAP PIC%', 'Saída para Investimentos / Reservas'),
  ('Ajuste de saldo%', 'Ajuste de conciliação'),
  ('Estorno - Transferência enviada pelo Pix%', 'Transferências entre contas'),
  ('Infotekton Gestao e Tecnologia%', 'Transferências entre contas'),
  ('PIX REC.OUTRA IF%', 'Transferências entre contas'),
  ('Pix recebido da Nu-Bank PJ%', 'Transferências entre contas'),
  ('TED recebida de Dirceu%', 'Transferências entre contas');

DROP TABLE IF EXISTS archive.alvo_20261102;
CREATE TABLE archive.alvo_20261102 AS
SELECT DISTINCT ON (t.id) t.id, t.category_id AS old_cat, t.status, c.id AS new_cat
  FROM public.transactions t
  JOIN archive.regras_20261102 r ON t.description ILIKE r.pat
  JOIN public.categories c ON c.name = r.cat
 WHERE t.category_id IS NULL AND t.status <> 'cancelled'
 ORDER BY t.id, length(r.pat) DESC;

INSERT INTO archive.categorizacao_20261102 (id, category_id, status, acao)
SELECT id, old_cat, status, 'categorizar' FROM archive.alvo_20261102
ON CONFLICT (id) DO NOTHING;

UPDATE public.transactions t SET category_id = a.new_cat FROM archive.alvo_20261102 a WHERE a.id = t.id;
DROP TABLE archive.alvo_20261102;
DROP TABLE archive.regras_20261102;

-- (4) Saldos
SELECT public.recalculate_account_balances_from_date('2026-04-01');

-- Conferência
SELECT acao, count(*) AS qtd FROM archive.categorizacao_20261102 GROUP BY acao;
SELECT count(*) AS ainda_sem_categoria FROM public.transactions WHERE category_id IS NULL AND status <> 'cancelled';

COMMIT;
