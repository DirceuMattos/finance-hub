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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, Info, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<FilterView>("all");
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));

  // Invoice payment dialog state
  const [payingCard, setPayingCard] = useState<{ id: string; name: string; total: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  const [y, m] = filterMonth.split("-").map(Number);
  const referenceMonth = `${y}-${String(m).padStart(2, "0")}-01`;

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
    cycleTotals.forEach((r: CycleTotals) => map.set(r.card_name, r));
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

  const handleOpenPayDialog = (cardId: string, cardName: string, totalPlanned: number, totalPaid: number) => {
    setPayingCard({ id: cardId, name: cardName, total: totalPlanned + totalPaid });
    setPayAmount(String((totalPlanned + totalPaid).toFixed(2)));
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayNotes("");
  };

  const handlePayInvoice = async () => {
    if (!payingCard) return;
    setPaying(true);
    try {
      const { error } = await (supabase as any)
        .from("card_invoice_payments")
        .upsert({
          card_id: payingCard.id,
          reference_month: referenceMonth,
          due_date: `${y}-${String(m).padStart(2, "0")}-25`,
          amount_paid: parseFloat(payAmount),
          payment_date: payDate,
          notes: payNotes || null,
        }, { onConflict: "card_id,reference_month" });
      if (error) throw error;
      toast.success(`Fatura de ${payingCard.name} quitada com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["card_cycle_totals"] });
      setPayingCard(null);
    } catch (e: any) {
      toast.error("Erro ao registrar pagamento: " + e.message);
    } finally {
      setPaying(false);
    }
  };

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
            const cycleData = byCard.get(card.name);
            const totalPaid = cycleData?.total_paid || 0;
            const totalPlanned = cycleData?.total_planned || 0;
            const usedAmount = totalPaid + totalPlanned;
            const invoicePaid = cycleData?.invoice_paid || false;
            const invoiceAmount = cycleData?.invoice_amount;
            const invoicePaymentDate = cycleData?.invoice_payment_date;
            const managerialUsagePct = managerialLimit > 0 ? Math.min((usedAmount / managerialLimit) * 100, 100) : 0;
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
                      {invoicePaid
                        ? <Badge className="bg-emerald-500 text-white text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Fatura Quitada</Badge>
                        : <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Ativo</Badge>
                      }
                    </div>
                  </div>
                  {card.issuer_bank && <p className="text-xs text-muted-foreground mt-1">{card.issuer_bank}</p>}
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Invoice paid info */}
                  {invoicePaid && invoiceAmount && (
                    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Fatura quitada em {invoicePaymentDate ? format(new Date(invoicePaymentDate + "T12:00:00"), "dd/MM/yyyy") : "—"} — {fmt(invoiceAmount)}
                    </div>
                  )}

                  {/* Alert banner when usage is high */}
                  {usageLevel !== "safe" && !invoicePaid && (
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
                      <p className="font-semibold">{fmt(usedAmount)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Teto Gerencial</p>
                      <p className="font-semibold">{fmt(managerialLimit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fecha / Vence</p>
                      <p className="font-semibold">Dia {card.closing_day} / {card.due_day}</p>
                    </div>
                  </div>

                  {(() => {
                    const limit = card.managerial_limit || 0;
                    const pct = limit > 0 ? (usedAmount / limit) * 100 : 0;
                    const remaining = limit - usedAmount;
                    const isOver = pct > 100;
                    const overAmount = usedAmount - limit;

                    if (limit === 0) {
                      return (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Sem teto definido
                          </span>
                        </div>
                      );
                    }

                    const barColor = isOver ? "bg-red-500" : pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
                    const barWidth = Math.min(pct, 100);

                    return (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Teto gerencial: {fmt(limit)}</span>
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
                    onClick={() => handleOpenPayDialog(card.id, card.name, totalPlanned, totalPaid)}
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    {invoicePaid ? "Atualizar Pagamento" : "Quitar Fatura"}
                  </Button>

                  <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {selectedMonthLabel} · Limite real: {fmt(card.credit_limit)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invoice Payment Dialog */}
      <Dialog open={!!payingCard} onOpenChange={(o) => { if (!o) setPayingCard(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar Fatura — {payingCard?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Valor Total do Ciclo</Label>
              <p className="text-sm text-muted-foreground">{payingCard ? fmt(payingCard.total) : ""}</p>
            </div>
            <div className="space-y-1">
              <Label>Valor Pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="space-y-1">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Observações (opcional)</Label>
              <Input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Ex: Pago via débito automático"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingCard(null)}>Cancelar</Button>
            <Button onClick={handlePayInvoice} disabled={paying || !payAmount || !payDate}>
              {paying ? "Salvando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

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

  const [y, m] = filterMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const { data: cardTotals = [] } = useQuery({
    queryKey: ["card_totals_by_card", filterMonth],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_card_total_by_card", {
        p_start: start,
        p_end: end,
      });
      if (error) throw error;
      return data as { card_name: string; total: number }[];
    },
  });

  const byCard = new Map<string, number>(
    cardTotals.map((r: any) => [r.card_name, Number(r.total)])
  );

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

                  {(() => {
                    const limit = card.managerial_limit || 0;
                    const pct = limit > 0 ? (usedAmount / limit) * 100 : 0;
                    const remaining = limit - usedAmount;
                    const isOver = pct > 100;
                    const overAmount = usedAmount - limit;

                    if (limit === 0) {
                      return (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Sem teto definido
                          </span>
                        </div>
                      );
                    }

                    const barColor = isOver ? "bg-red-500" : pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
                    const barWidth = Math.min(pct, 100);

                    return (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Teto gerencial: {fmt(limit)}</span>
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
