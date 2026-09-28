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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Info, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { cardCycleMonthOf, cardCycleWindow, formatIsoDateBR } from "@/lib/cardCycle";
import { CardInvoiceSettleDialog } from "@/components/cartoes/CardInvoiceSettleDialog";

type FilterView = "all" | "personal" | "business";

function buildMonthOptions() {
  const options: { value: string; label: string }[] = [];
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

interface CycleTotals {
  card_name: string;
  card_id: string;
  total_paid: number;
  total_planned: number;
  invoice_paid: boolean;
  invoice_amount: number | null;
  invoice_payment_date: string | null;
}

export default function Cartoes() {
  const { data: cards = [], isLoading } = useCards();
  const { data: entities = [] } = useFinancialEntities();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<FilterView>("all");
  // Padrão: a fatura do ciclo em andamento hoje (após o vencimento do dia 25, já é a do mês seguinte).
  const currentCycleMonth = useMemo(() => cardCycleMonthOf(format(new Date(), "yyyy-MM-dd"), 25), []);
  const [filterMonth, setFilterMonth] = useState(currentCycleMonth);

  // Settle dialog state
  const [settleCard, setSettleCard] = useState<{ id: string; name: string; dueDay: number; referenceMonth: string; label: string } | null>(null);

  const [y, m] = filterMonth.split("-").map(Number);
  const referenceMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const prevMonth = format(addMonths(new Date(y, m - 1, 1), -1), "yyyy-MM");
  const prevReferenceMonth = `${prevMonth}-01`;
  const prevMonthLabel = format(new Date(y, m - 2, 1), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());

  // Fatura anterior: detecta ciclo vencido que ainda não foi conferido e fechado.
  const { data: prevCycleTotals = [] } = useQuery({
    queryKey: ["card_cycle_totals", prevMonth],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_card_cycle_totals", { p_month: prevReferenceMonth });
      if (error) throw error;
      return data as CycleTotals[];
    },
  });
  const byCardPrev = useMemo(() => {
    const map = new Map<string, CycleTotals>();
    prevCycleTotals.forEach((r: CycleTotals) => map.set(r.card_id, r));
    return map;
  }, [prevCycleTotals]);

  const { data: cycleTotals = [] } = useQuery({
    queryKey: ["card_cycle_totals", filterMonth],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_card_cycle_totals", {
        p_month: referenceMonth,
      });
      if (error) throw error;
      return data as CycleTotals[];
    },
  });

  const byCard = useMemo(() => {
    const map = new Map<string, CycleTotals>();
    cycleTotals.forEach((r: CycleTotals) => map.set(r.card_id, r));
    return map;
  }, [cycleTotals]);

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

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar cartão..." hasActiveFilters={filterMonth !== currentCycleMonth} onClear={() => setFilterMonth(currentCycleMonth)}>
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
            // Teto gerencial: só o valor cadastrado; sem fallback para o limite real.
            const managerialLimit = Number(card.managerial_limit) || 0;
            const creditLimit = Number(card.credit_limit) || 0;
            const cycle = cardCycleWindow(filterMonth, card.due_day);
            const entityType = entityMap.get(card.financial_entity_id);
            const cycleData = byCard.get(card.id);
            const totalPaid = cycleData?.total_paid || 0;
            const totalPlanned = cycleData?.total_planned || 0;
            const cycleTotal = totalPaid + totalPlanned;
            // Fechada: operador conferiu e virou a fatura. Paga sem fechamento: nada pendente, falta conferir.
            const invoiceClosed = cycleData?.invoice_paid || false;
            const paidNotClosed = !invoiceClosed && totalPlanned === 0 && totalPaid > 0;
            const invoicePaid = invoiceClosed || paidNotClosed;
            const prevData = byCardPrev.get(card.id);
            const prevCycle = cardCycleWindow(prevMonth, card.due_day);
            const prevPlanned = Number(prevData?.total_planned) || 0;
            const prevPaid = Number(prevData?.total_paid) || 0;
            const prevOpen = !!prevData && !prevData.invoice_paid && prevPlanned + prevPaid > 0;
            const openSettle = (ref: string, label: string) =>
              setSettleCard({ id: card.id, name: card.name, dueDay: card.due_day || 25, referenceMonth: ref, label });
            // Uso do teto = o que ainda está em aberto no ciclo; zera quando a fatura é quitada.
            const usedAmount = totalPlanned;
            const invoiceAmount = cycleData?.invoice_amount ?? (invoicePaid ? totalPaid : null);
            const invoicePaymentDate = cycleData?.invoice_payment_date;
            const managerialUsagePct = managerialLimit > 0 ? (usedAmount / managerialLimit) * 100 : 0;
            const usageLevel = getUsageLevel(managerialUsagePct);

            return (
              <Card key={card.id} className={`relative overflow-hidden ${usageLevel === "danger" ? "border-destructive/50" : usageLevel === "warning" ? "border-amber-500/50" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{card.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {entityType === "personal" && <Badge variant="outline" className="text-[10px] border-primary text-primary">Pessoal</Badge>}
                      {entityType === "business" && <Badge variant="outline" className="text-[10px] border-accent-foreground text-accent-foreground">Empresa</Badge>}
                      {invoiceClosed
                        ? <Badge className="bg-emerald-500 text-white text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Fatura fechada</Badge>
                        : paidNotClosed
                          ? <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-400">Paga · falta fechar</Badge>
                          : <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Em aberto</Badge>
                      }
                    </div>
                  </div>
                  {card.issuer_bank && <p className="text-xs text-muted-foreground mt-1">{card.issuer_bank}</p>}
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Fatura anterior vencida e não fechada */}
                  {prevOpen && (
                    <div className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium bg-amber-500/10 text-amber-800 dark:text-amber-400">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Fatura de {prevMonthLabel} (venc. {formatIsoDateBR(prevCycle.end)}) não foi fechada ·{" "}
                        {prevPlanned > 0 ? `${fmt(prevPlanned)} em aberto` : "tudo pago, falta conferir"}
                      </span>
                      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => openSettle(prevReferenceMonth, prevMonthLabel)}>
                        Conferir
                      </Button>
                    </div>
                  )}

                  {/* Situação da fatura do mês selecionado */}
                  {invoiceClosed && invoiceAmount && (
                    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Fatura fechada{invoicePaymentDate ? ` · pago até ${formatIsoDateBR(invoicePaymentDate)}` : ""} — {fmt(invoiceAmount)}
                    </div>
                  )}
                  {paidNotClosed && (
                    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Todos os lançamentos do ciclo estão pagos ({fmt(totalPaid)}). Confira e feche a fatura.
                    </div>
                  )}

                  {/* Alert banner when usage is high */}
                  {managerialLimit > 0 && usageLevel !== "safe" && !invoicePaid && (
                    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
                      usageLevel === "danger"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/10 text-amber-700"
                    }`}>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {usageLevel === "danger"
                        ? `Teto gerencial atingido (${managerialUsagePct.toFixed(0)}%)`
                        : `Uso elevado do teto gerencial (${managerialUsagePct.toFixed(0)}%)`
                      }
                    </div>
                  )}

                  {/* Paid vs Planned breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Pago</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">{fmt(totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">A Pagar</p>
                      <p className="font-semibold text-amber-600">{fmt(totalPlanned)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Total Ciclo</p>
                      <p className="font-semibold">{fmt(cycleTotal)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Teto Gerencial</p>
                      <p className="font-semibold">{managerialLimit > 0 ? fmt(managerialLimit) : <span className="text-muted-foreground font-normal text-xs">Não cadastrado</span>}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fecha / Vence</p>
                      <p className="font-semibold">Dia {card.closing_day} / {card.due_day}</p>
                    </div>
                  </div>

                  {(() => {
                    const limit = managerialLimit;
                    const pct = limit > 0 ? (usedAmount / limit) * 100 : 0;
                    const remaining = limit - usedAmount;
                    const isOver = pct > 100;
                    const overAmount = usedAmount - limit;

                    if (limit === 0) {
                      return (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Teto gerencial não cadastrado — defina em Configurações › Cartões
                          </span>
                        </div>
                      );
                    }

                    const barColor = isOver ? "bg-red-500" : pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
                    const barWidth = Math.min(pct, 100);

                    return (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Em aberto no ciclo: {fmt(usedAmount)} de {fmt(limit)}</span>
                          <span className={isOver ? "text-red-600 font-semibold dark:text-red-400" : "font-medium"}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
                        </div>
                        {isOver ? (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                            ⚠ Ultrapassou {fmt(overAmount)} ({(pct - 100).toFixed(1)}% acima do teto)
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Restam {fmt(remaining)} ({(100 - pct).toFixed(1)}% livre)
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Quitar fatura button */}
                  <Button
                    size="sm"
                    variant={invoicePaid ? "outline" : "default"}
                    className="w-full"
                    onClick={() => openSettle(referenceMonth, selectedMonthLabel)}
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    {invoiceClosed ? "Ver fatura fechada" : paidNotClosed ? "Conferir e fechar fatura" : "Quitar fatura"}
                  </Button>

                  <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {selectedMonthLabel} · Ciclo {formatIsoDateBR(cycle.start)} a {formatIsoDateBR(cycle.end)} · Limite real: {creditLimit > 0 ? fmt(creditLimit) : "não cadastrado"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invoice Settle Dialog */}
      {settleCard && (
        <CardInvoiceSettleDialog
          open={!!settleCard}
          onOpenChange={(o) => { if (!o) setSettleCard(null); }}
          cardId={settleCard.id}
          cardName={settleCard.name}
          dueDay={settleCard.dueDay}
          referenceLabel={settleCard.label}
          referenceMonth={settleCard.referenceMonth}
        />
      )}
    </AppLayout>
  );
}
