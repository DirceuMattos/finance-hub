-- Corrige o fechamento de out/2026 da classe "US$ - Dólar": gravado 5.668.088,00 (provável 56.680,88
-- digitado sem a vírgula). Isso fazia o gráfico de Investimentos ir a ~6 milhões e os meses anteriores
-- (~550 mil) parecerem zero. CONFIRME O VALOR REAL ANTES DE RODAR e troque 56680.88 se for outro.
-- Só altera se o valor gravado ainda for o errado.
UPDATE public.investment_snapshots s
   SET closing_value = 56680.88
  FROM public.investment_classes c
 WHERE c.id = s.investment_class_id
   AND c.name = 'US$ - Dólar'
   AND s.reference_month = '2026-10-01'
   AND s.closing_value = 5668088.00
RETURNING c.name, s.reference_month, s.opening_value, s.closing_value;
-- Rollback (se preciso): mesmo UPDATE trocando os valores (56680.88 -> 5668088.00).
