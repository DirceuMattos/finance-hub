import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCards } from "@/hooks/useCards";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useCardInvoicesByCard } from "@/hooks/useCardInvoiceTransactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard } from "lucide-react";

type FilterView = "all" | "personal" | "business";

export default function Cartoes() {
  const { data: cards = [], isLoading } = useCards();
  const { data: entities = [] } = useFinancialEntities();
  const { byCard } = useCardInvoicesByCard();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<FilterView>("all");

  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities.forEach(e => map.set(e.id, e.entity_type));
    return map;
  }, [entities]);

  const filtered = cards.filter((c) => {
    if (!c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (view !== "all") {
      const type = entityMap.get(c.financial_entity_id);
      if (type !== view) return false;
    }
    return true;
  });

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <AppLayout>
      <PageHeader title="Cartões" description="Visão geral dos seus cartões de crédito" />

      <Tabs value={view} onValueChange={(v) => setView(v as FilterView)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="business">Empresarial</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar cartão..." />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-32 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum cartão encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((card) => {
            const managerialLimit = card.managerial_limit || card.credit_limit;
            const entityType = entityMap.get(card.financial_entity_id);
            const usedAmount = byCard.get(card.name) || 0;
            const usagePct = card.credit_limit > 0 ? Math.min((usedAmount / card.credit_limit) * 100, 100) : 0;
            const managerialUsagePct = managerialLimit > 0 ? Math.min((usedAmount / managerialLimit) * 100, 100) : 0;

            return (
              <Card key={card.id} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{card.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {entityType === "personal" && <Badge variant="outline" className="text-[10px] border-primary text-primary">Pessoal</Badge>}
                      {entityType === "business" && <Badge variant="outline" className="text-[10px] border-accent-foreground text-accent-foreground">Empresa</Badge>}
                      {card.is_active
                        ? <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Ativo</Badge>
                        : <Badge variant="secondary">Inativo</Badge>
                      }
                    </div>
                  </div>
                  {card.issuer_bank && <p className="text-xs text-muted-foreground mt-1">{card.issuer_bank}</p>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Limite</p>
                      <p className="font-semibold">{fmt(card.credit_limit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Teto Gerencial</p>
                      <p className="font-semibold">{fmt(managerialLimit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fecha Dia</p>
                      <p className="font-semibold">{card.closing_day}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Vence Dia</p>
                      <p className="font-semibold">{card.due_day}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Uso do Limite</span>
                      <span className="font-medium">{fmt(usedAmount)} / {fmt(card.credit_limit)}</span>
                    </div>
                    <Progress value={usagePct} className="h-2" />
                    <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                      Baseado em faturas previstas (status planned) registradas em Lançamentos.
                    </p>
                  </div>
                  {card.managerial_limit && card.managerial_limit < card.credit_limit && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Uso do Teto Gerencial</span>
                        <span className="font-medium">{fmt(usedAmount)} / {fmt(card.managerial_limit)}</span>
                      </div>
                      <Progress value={managerialUsagePct} className="h-2" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Entidade: {card.financial_entities?.name || "—"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
