import { useState, useMemo } from "react";
import { format, subMonths, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCards } from "@/hooks/useCards";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useCardInstallments } from "@/hooks/useCardInstallments";
import { useTransactions } from "@/hooks/useTransactions";
import { CARD_INVOICE_CENTER_COSTS } from "@/lib/cardInvoiceRules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Info, AlertTriangle } from "lucide-react";

type FilterView = "all" | "personal" | "business";

function buildMonthOptions() {
  const options: { value: string; label: string }[] = [{ value: "all", label: "Todos os meses" }];
  const now = startOfMonth(new Date());
  for (let i = -6; i <= 3; i++) {
    const d = i < 0 ? subMonths(now, -i) : addMonths(now, i);
    const val = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
    options.push({ value: val, label });
  }
  return options;
}

function getUsageLevel(pct: number): "safe" | "warning" | "danger" {
  if (pct >= 90) return "danger";
  if (pct >= 70) return "warning";
  return "safe";
}

export default function Cartoes() {
  const { data: cards = [], isLoading } = useCards();
  const { data: entities = [] } = useFinancialEntities();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<FilterView>("all");
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: installments = [] } = useCardInstallments(filterMonth);
  const byCard = useMemo(() => {
    const map = new Map<string, number>();
    installments.forEach((inst: any) => {
      const cardName = inst.card_purchases?.cards?.name || "—";
      map.set(cardName, (map.get(cardName) || 0) + Math.abs(inst.amount || 0));
    });
    return map;
  }, [installments]);

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities.forEach(e => map.set(e.id, e.entity_type));
    return map;
  }, [entities]);

  const filtered = cards.filter((c) => {
    if (search) {
      const s = search.toLowerCase();
      const searchable = [c.name, c.issuer_bank, c.financial_entities?.name].filter(Boolean).join(" ").toLowerCase();
      if (!searchable.includes(s)) return false;
    }
    if (view !== "all") {
      const type = entityMap.get(c.financial_entity_id);
      if (type !== view) return false;
    }
    return true;
  });

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const selectedMonthLabel = monthOptions.find(o => o.value === filterMonth)?.label || filterMonth;

  return (
    <AppLayout>
      <PageHeader
        title="Cartões"
        description={`Visão ${view === "all" ? "consolidada" : view === "personal" ? "pessoal" : "empresarial"} dos seus cartões de crédito`}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as FilterView)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Consolidado</TabsTrigger>
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="business">Empresarial</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar cartão..." hasActiveFilters={filterMonth !== format(new Date(), "yyyy-MM")} onClear={() => setFilterMonth(format(new Date(), "yyyy-MM"))}>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

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
            const managerialUsagePct = managerialLimit > 0 ? Math.min((usedAmount / managerialLimit) * 100, 100) : 0;
            const usageLevel = getUsageLevel(managerialUsagePct);

            const progressColor =
              usageLevel === "danger"
                ? "bg-destructive"
                : usageLevel === "warning"
                  ? "bg-[hsl(var(--warning,45_100%_51%))]"
                  : "";

            return (
              <Card key={card.id} className={`relative overflow-hidden ${usageLevel === "danger" ? "border-destructive/50" : usageLevel === "warning" ? "border-[hsl(var(--warning,45_100%_51%))]/50" : ""}`}>
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
                  {/* Alert banner when usage is high */}
                  {usageLevel !== "safe" && (
                    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
                      usageLevel === "danger"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-[hsl(var(--warning,45_100%_51%))]/10 text-[hsl(var(--warning,45_100%_51%))]"
                    }`}>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {usageLevel === "danger"
                        ? `Teto gerencial atingido (${managerialUsagePct.toFixed(0)}%)`
                        : `Uso elevado do teto gerencial (${managerialUsagePct.toFixed(0)}%)`
                      }
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Teto Gerencial</p>
                      <p className="font-semibold">{fmt(managerialLimit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Usado {filterMonth !== "all" ? `em ${selectedMonthLabel}` : "(acumulado)"}
                      </p>
                      <p className="font-semibold">{fmt(usedAmount)}</p>
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
                      <span className="text-muted-foreground">Uso do Teto Gerencial</span>
                      <span className="font-medium">{fmt(usedAmount)} / {fmt(managerialLimit)}</span>
                    </div>
                    <Progress value={managerialUsagePct} className={`h-2 ${progressColor ? `[&>div]:${progressColor}` : ""}`} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Limite real do cartão: {fmt(card.credit_limit)}</p>
                  <p className="text-xs text-muted-foreground">
                    Entidade: {card.financial_entities?.name || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Dados calculados a partir de lançamentos identificados por centro de custo.
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
