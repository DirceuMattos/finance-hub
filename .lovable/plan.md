
Objetivo: corrigir de forma definitiva os 2 grupos de problemas que ainda restam:
1. cartões não aparecem / filtro de mês não funciona em Lançamentos e Compras no Cartão;
2. lançamentos comuns de abril/2026 aparecem como “Cancelado”.

Diagnóstico confirmado no código:
- `ComprasCartao.tsx` e `Lancamentos.tsx` ainda chamam `useCardInstallments()` sem passar o mês filtrado.
- `useCardInstallments.ts` continua buscando em massa com `order("billing_month")` ascendente + `limit(5000)`. Pela própria requisição de rede, a tela está carregando registros antigos de 2023 primeiro. Se houver mais de 5000 parcelas, os meses recentes ficam fora da resposta.
- Depois disso, o filtro de mês é feito no frontend. Ou seja: a tela tenta filtrar um mês que nem chegou a ser carregado.
- Em `Lancamentos.tsx`, as parcelas de cartão entram com `entity_type: null`, porque o hook traz `financial_entities(name)` mas não traz `entity_type`. Então filtros por entidade/tipo podem excluir parcelas indevidamente.
- O status “Cancelado” dos lançamentos comuns não está sendo inventado pelo componente visual. O badge só mostra “Cancelado” quando `status === "cancelled"`. Portanto, abril/2026 precisa ser tratado como problema de dado retornado pela fonte ou de gravação anterior, não apenas de layout.

Plano de implementação:
1. Reestruturar `useCardInstallments.ts`
- Trocar a assinatura simples por filtros explícitos, incluindo mês de referência.
- Aplicar filtro server-side por intervalo de datas já na query.
- Usar ordenação mais segura para meses recentes.
- Trazer também `financial_entities(entity_type)` para suportar filtros corretos na tela de Lançamentos.
- Manter compatibilidade com os usos atuais onde possível.

2. Corrigir o módulo Compras no Cartão
- Passar o mês selecionado para o hook, em vez de carregar tudo e filtrar só no cliente.
- Fazer o filtro mensal pela data de vencimento, que é a referência pedida para essa tela.
- Manter o default no mês atual.
- Ajustar a geração de opções de mês para não depender apenas dos dados já carregados, evitando lista incompleta quando a consulta vier vazia.

3. Corrigir o módulo Lançamentos para cartões
- Passar o mês selecionado para a busca de parcelas de cartão.
- Filtrar as parcelas de cartão pelo vencimento/mês correto na própria consulta.
- Popular `entity_type` e demais metadados das parcelas para que os filtros “Origem”, “Entidade” e “Status” funcionem de forma consistente.
- Revisar a montagem de `cardRows` para não depender de dados truncados.

4. Tratar o caso específico de abril/2026 nos lançamentos comuns
- Revisar `useTransactions.ts` para permitir leitura por mês filtrado e reduzir ambiguidade.
- Verificar se abril/2026 está vindo da base realmente com `status = cancelled`.
- Se o problema for dado incorreto histórico, preparar uma correção direcionada apenas para os registros afetados.
- Se o problema for interpretação inconsistente de status legado, normalizar apenas valores inválidos; não sobrescrever “cancelled” válido.

5. Validar os fluxos afetados
- Compras no Cartão: abrir no mês atual e confirmar que há parcelas visíveis.
- Lançamentos: visão consolidada, somente cartão e somente lançamentos comuns.
- Abril/2026: confirmar se os comuns deixam de aparecer todos como cancelados.
- Validar filtros de entidade, mês e origem após a correção.

Arquivos a ajustar:
- `src/hooks/useCardInstallments.ts`
- `src/pages/ComprasCartao.tsx`
- `src/pages/Lancamentos.tsx`
- `src/hooks/useTransactions.ts`

Detalhes técnicos:
- A correção principal não é “aumentar limite” novamente; é mover o filtro do mês para a query.
- Para cartões, o mês deve usar `due_date` como referência visual/funcional.
- Para lançamentos comuns de abril/2026, a UI atual já prova que o valor `cancelled` está chegando no campo `status`; por isso a revisão precisa incluir a origem dos dados, não só o badge.

Banco de dados:
- Não prevejo mudança estrutural.
- Pode ser necessária uma correção pontual de dados de abril/2026 se a revisão confirmar que esses registros foram gravados com status incorreto.
