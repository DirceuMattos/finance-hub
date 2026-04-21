import { useState, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Ban, CreditCard, CheckCircle, Copy, Upload, List, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { isCardInvoiceByCenterCost, getCardNameFromCenterCost, isCardInvoice, getCardInvoiceLabel } from "@/lib/cardInvoiceRules";
import { useTransactions } from "@/hooks/useTransactions";
import { useCardInstallments, useCardInstallmentStatusUpdate } from "@/hooks/useCardInstallments";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useCards } from "@/hooks/useCards";
import { TransactionForm } from "@/components/lancamentos/TransactionForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import { PaymentDialog } from "@/components/lancamentos/PaymentDialog";
import { CsvImportDialog } from "@/components/lancamentos/CsvImportDialog";
import { toast } from "sonner";
import type { Transaction } from "@/types/database";

// Unified row type for the table
interface UnifiedRow {
  id: string;
  description: string;
  transaction_type: string;
  amount: number;
  raw_amount?: number;
  competence_date: string;
  due_date: string | null;
  payment_date: string | null;
  status: string;
  category_name: string | null;
  entity_name: string | null;
  entity_type: string | null;
  account_name: string | null;
  payee: string | null;
  notes?: string | null;
  installment_number: number | null;
  installment_total: number | null;
  center_cost?: string;
  card_name?: string | null;
  card_id?: string | null;
  category_id?: string | null;
  financial_entity_id?: string;
  account_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_card_installment: boolean;
  _original?: Transaction;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Realizado</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelado</Badge>;
  return <Badge variant="outline" className="border-[hsl(var(--warning))] text-[hsl(var(--warning))]">Previsto</Badge>;
}

function TypeBadge({ type }: { type: string }) {
  if (type === "income") return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Receita</Badge>;
  if (type === "transfer") return <Badge variant="secondary">Transferência</Badge>;
  return <Badge variant="destructive">Despesa</Badge>;
}

function EntityTypeBadge({ entityType }: { entityType?: string | null }) {
  if (entityType === "personal") return <Badge variant="outline" className="text-xs border-primary text-primary">Pessoal</Badge>;
  if (entityType === "business") return <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">Empresa</Badge>;
  return null;
}

function InstallmentBadge({ number, total }: { number: number | null; total: number | null }) {
  const n = number ?? 1;
  const t = total ?? 1;
  if (t <= 1) return null;
  return <Badge variant="outline" className="text-[10px] font-mono">{n}/{t}</Badge>;
}

function buildMonthOptions() {
  const options: { value: string; label: string }[] = [{ value: "all", label: "Todos os meses" }];
  const now = startOfMonth(new Date());
  for (let i = -12; i <= 6; i++) {
    const d = i < 0 ? subMonths(now, -i) : addMonths(now, i);
    const val = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
    options.push({ value: val, label });
  }
  return options;
}

export default function Lancamentos() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialMonth = searchParams.get("mes") || format(new Date(), "yyyy-MM");
  const [filterMonth, setFilterMonth] = useState(initialMonth);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data = [], isLoading, create, update, remove } = useTransactions(filterMonth);
  const { data: cardInstallments = [], isLoading: loadingCI } = useCardInstallments(filterMonth);
  const updateInstallmentStatus = useCardInstallmentStatusUpdate();
  const { data: entities = [] } = useFinancialEntities();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: cardsList = [] } = useCards();

  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterTypeTab, setFilterTypeTab] = useState("all");
  const [filterCardInvoice, setFilterCardInvoice] = useState("all");
  const [filterCard, setFilterCard] = useState("all"); // by specific card name
  const [filterInstallment, setFilterInstallment] = useState("all"); // all | yes | no
  const [filterSource, setFilterSource] = useState("all"); // all | transactions | card

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingInstallment, setDeletingInstallment] = useState<string | null>(null);
  const [settling, setSettling] = useState<Transaction | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const lastSavedRef = useRef<Transaction | null>(null);

  const personalEntities = useMemo(() => entities.filter(e => e.entity_type === "personal"), [entities]);
  const businessEntities = useMemo(() => entities.filter(e => e.entity_type === "business"), [entities]);

  const filteredAccounts = useMemo(() => {
    if (filterEntity === "all_personal") {
      const personalIds = new Set(personalEntities.map(e => e.id));
      return accounts.filter(a => personalIds.has(a.financial_entity_id));
    }
    if (filterEntity === "all_business") {
      const businessIds = new Set(businessEntities.map(e => e.id));
      return accounts.filter(a => businessIds.has(a.financial_entity_id));
    }
    if (filterEntity !== "all") {
      return accounts.filter(a => a.financial_entity_id === filterEntity);
    }
    return accounts;
  }, [accounts, filterEntity, personalEntities, businessEntities]);

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  // Map card installments to unified rows
  const cardRows: UnifiedRow[] = useMemo(() => {
    return cardInstallments.map(inst => ({
      id: `ci_${inst.id}`,
      description: inst.card_purchases?.description || "Compra cartão",
      transaction_type: "expense",
      amount: inst.amount,
      raw_amount: inst.amount,
      competence_date: inst.billing_month,
      due_date: inst.due_date,
      payment_date: null,
      status: inst.status === "paid" ? "paid"
        : inst.status === "cancelled" ? "cancelled"
        : inst.status === "projected" ? "planned"
        : inst.status === "pending" ? "planned"
        : inst.status === "open" ? "planned"
        : "planned",
      category_name: inst.card_purchases?.categories?.name || null,
      entity_name: inst.card_purchases?.financial_entities?.name || null,
      entity_type: (inst.card_purchases?.financial_entities as any)?.entity_type || null,
      account_name: null,
      payee: inst.card_purchases?.payee || null,
      notes: inst.card_purchases?.notes || null,
      installment_number: inst.installment_number,
      installment_total: inst.card_purchases?.installments_count || null,
      card_name: (inst.card_purchases as any)?.cards?.name || null,
      card_id: inst.card_purchases?.card_id || null,
      financial_entity_id: inst.card_purchases?.financial_entity_id,
      created_at: (inst as any).created_at || null,
      updated_at: (inst as any).updated_at || null,
      is_card_installment: true,
    }));
  }, [cardInstallments]);

  // Map transactions to unified rows
  const txRows: UnifiedRow[] = useMemo(() => {
    return data.map(t => ({
      id: t.id,
      description: t.description,
      transaction_type: t.transaction_type,
      amount: t.amount,
      raw_amount: t.amount,
      competence_date: t.competence_date,
      due_date: t.due_date,
      payment_date: (t as any).payment_date,
      status: t.status,
      category_name: t.categories?.name || null,
      entity_name: t.financial_entities?.name || null,
      entity_type: (t.financial_entities as any)?.entity_type || null,
      account_name: t.accounts?.name || null,
      payee: (t as any).payee || null,
      notes: (t as any).notes || null,
      installment_number: t.installment_number,
      installment_total: t.installment_total,
      center_cost: (t as any).center_cost,
      card_name: cardsList.find((card) => card.id === t.card_id)?.name || (t as any).center_cost || null,
      card_id: t.card_id || null,
      category_id: t.category_id,
      financial_entity_id: t.financial_entity_id,
      account_id: t.account_id,
      source_type: t.source_type,
      source_id: t.source_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
      is_card_installment: false,
      _original: t,
    }));
  }, [data, cardsList]);

  // Merge and filter
  const allRows = useMemo(() => {
    if (filterSource === "transactions") return txRows;
    if (filterSource === "card") return cardRows;
    return [...txRows, ...cardRows];
  }, [txRows, cardRows, filterSource]);

  const filtered = useMemo(() => {
    return allRows.filter((t) => {
      if (search) {
        const s = search.toLowerCase();
        const fmtVal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(t.amount);
        const installmentStr = (t.installment_total && t.installment_total > 1)
          ? `${t.installment_number ?? 1}/${t.installment_total}`
          : "";
        const searchable = [
          t.description, t.payee, t.category_name, t.entity_name, t.account_name,
          t.center_cost, t.card_name, t.notes, installmentStr, fmtVal, String(t.amount),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      if (filterEntity === "all_personal") {
        if (t.entity_type !== "personal") return false;
      } else if (filterEntity === "all_business") {
        if (t.entity_type !== "business") return false;
      } else if (filterEntity !== "all" && t.financial_entity_id !== filterEntity) return false;
      if (filterAccount !== "all" && !t.is_card_installment && t.account_id !== filterAccount) return false;
      if (filterCategory !== "all" && !t.is_card_installment && t.category_id !== filterCategory) return false;
      // Status filter is applied server-side for transactions; still filter card installments client-side
      if (filterStatus !== "all" && t.is_card_installment && t.status !== filterStatus) return false;
      if (filterTypeTab !== "all" && t.transaction_type !== filterTypeTab) return false;
      if (filterCard !== "all" && t.card_name !== filterCard) return false;
      if (filterInstallment === "yes" && !((t.installment_total ?? 1) > 1)) return false;
      if (filterInstallment === "no" && ((t.installment_total ?? 1) > 1)) return false;
      if (!t.is_card_installment) {
        const isCCInvoice = isCardInvoiceByCenterCost(t.center_cost) || isCardInvoice(t.category_name || "");
        if (filterCardInvoice === "card_invoice" && !isCCInvoice) return false;
        if (filterCardInvoice === "non_card_invoice" && isCCInvoice) return false;
        if (filterCardInvoice === "bra_pessoal" && !(isCCInvoice && getCardNameFromCenterCost(t.center_cost) === "BRA Pessoal")) return false;
        if (filterCardInvoice === "nu_infotkt" && !(isCCInvoice && getCardNameFromCenterCost(t.center_cost) === "Nu Infotkt")) return false;
      }
      // Month filtering is now done server-side in the hooks
      return true;
    });
  }, [allRows, search, filterEntity, filterAccount, filterCategory, filterStatus, filterTypeTab, filterCardInvoice, filterCard, filterInstallment]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d: string | null) => d ? format(parseISO(d), "dd/MM/yyyy") : "—";
  const fmtMonth = (d: string | null) => d ? format(parseISO(d), "MM/yyyy") : "—";
  const fmtDateTime = (d?: string | null) => d ? format(parseISO(d), "dd/MM/yyyy HH:mm") : "—";
  const isUpdatedToday = (d?: string | null) => d ? format(parseISO(d), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") : false;

  const listSummary = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.count += 1;
        if (row.transaction_type === "income") acc.income += Math.abs(row.amount || 0);
        if (row.transaction_type === "expense") acc.expense += Math.abs(row.amount || 0);
        return acc;
      },
      { count: 0, income: 0, expense: 0 }
    );
  }, [filtered]);

  const columns: Column<UnifiedRow>[] = [
    { key: "due_date", header: "Vencimento", sortable: true, sortValue: (r) => r.due_date || "", render: (r) => fmtDate(r.due_date) },
    { key: "competence_date", header: "Mês do Evento", sortable: true, sortValue: (r) => r.competence_date || "", render: (r) => fmtMonth(r.competence_date) },
    {
      key: "description", header: "Descrição", sortable: true, sortValue: (r) => r.description.toLowerCase(),
      render: (r) => {
        const diagnosticContent = !r.is_card_installment ? (
          <div className="space-y-1 text-xs">
            <div><span className="text-muted-foreground">ID:</span> {r.id}</div>
            <div><span className="text-muted-foreground">Valor bruto:</span> {fmt(r.raw_amount ?? r.amount)}</div>
            <div><span className="text-muted-foreground">Pagamento:</span> {fmtDate(r.payment_date)}</div>
            <div><span className="text-muted-foreground">Atualizado:</span> {fmtDateTime(r.updated_at)}</div>
            <div><span className="text-muted-foreground">Origem:</span> {r.source_type || "manual"}</div>
          </div>
        ) : null;

        const renderWithDiagnostic = (content: React.ReactNode) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 cursor-help">{content}</div>
              </TooltipTrigger>
              {diagnosticContent && <TooltipContent side="right" className="max-w-xs">{diagnosticContent}</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        );

        if (r.is_card_installment) {
          return renderWithDiagnostic(
            <div className="flex items-center gap-1.5">
              <span>{r.description}</span>
              <InstallmentBadge number={r.installment_number} total={r.installment_total} />
              <Badge variant="outline" className="text-xs border-primary text-primary gap-1">
                <CreditCard className="h-3 w-3" />Cartão (legado)
              </Badge>
            </div>
          );
        }
        const isCCInvoice = isCardInvoiceByCenterCost(r.center_cost) || isCardInvoice(r.category_name || "");
        if (isCCInvoice) {
          const cardLabel = getCardNameFromCenterCost(r.center_cost) || getCardInvoiceLabel(r.category_name || "");
          return renderWithDiagnostic(
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span>Pagamento de Fatura — {cardLabel || "Cartão"}</span>
                <Badge variant="outline" className="text-xs border-primary text-primary gap-1">
                  <CreditCard className="h-3 w-3" />Fatura
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{r.description}</span>
            </div>
          );
        }
        return renderWithDiagnostic(
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span>{r.description}</span>
              <InstallmentBadge number={r.installment_number} total={r.installment_total} />
              {isUpdatedToday(r.updated_at) && <Badge variant="outline" className="text-[10px]">Alterado hoje</Badge>}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{r.id.slice(0, 8)} · bruto {fmt(r.raw_amount ?? r.amount)} · upd {fmtDateTime(r.updated_at)}</span>
          </div>
        );
      },
    },
    { key: "transaction_type", header: "Tipo", sortable: true, sortValue: (r) => r.transaction_type, render: (r) => <TypeBadge type={r.transaction_type} /> },
    { key: "payee", header: "Favorecido", sortable: true, sortValue: (r) => r.payee || "", render: (r) => r.payee || "—" },
    { key: "category", header: "Categoria", sortable: true, sortValue: (r) => r.category_name || "", render: (r) => r.category_name || "—" },
    {
      key: "entity", header: "Entidade", sortable: true, sortValue: (r) => r.entity_name || "",
      render: (r) => {
        if (!r.entity_name) return "—";
        return <EntityTypeBadge entityType={r.entity_type} />;
      },
    },
    { key: "account", header: "Conta", sortable: true, sortValue: (r) => r.account_name || "", render: (r) => r.account_name || "—" },
    { key: "card", header: "Cartão", sortable: true, sortValue: (r) => r.card_name || "", render: (r) => r.card_name ? <Badge variant="outline" className="text-[10px] gap-1"><CreditCard className="h-3 w-3" />{r.card_name}</Badge> : "—" },
    { key: "amount", header: "Valor", sortable: true, sortValue: (r) => r.amount, render: (r) => <div className="flex flex-col"><span className={r.transaction_type === "income" ? "text-[hsl(var(--success))]" : r.amount < 0 ? "text-destructive font-medium" : "text-foreground"}>{fmt(r.amount)}</span>{!r.is_card_installment && <span className="text-[10px] text-muted-foreground">DB: {fmt(r.raw_amount ?? r.amount)}</span>}</div> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "payment_date", header: "Pagamento", sortable: true, sortValue: (r) => r.payment_date || "", render: (r) => fmtDate(r.payment_date) },
    {
      key: "actions", header: "", render: (r) => {
        if (r.is_card_installment) {
          const realId = r.id.replace("ci_", "");
          const isPending = r.status === "planned";
          const isPaid = r.status === "paid";
          return (
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePromoteInstallment(r)} title="Editar (migra para lançamento unificado)">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {isPending && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateInstallmentStatus.mutate({ id: realId, status: "paid" })} title="Marcar como pago">
                  <CheckCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                </Button>
              )}
              {isPaid && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateInstallmentStatus.mutate({ id: realId, status: "projected" })} title="Reverter para previsto">
                  <Ban className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletingInstallment(realId)} title="Excluir parcela legada">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          );
        }
        const orig = r._original!;
        return (
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(orig); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
            {orig.status === "planned" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSettling(orig)} title="Registrar baixa"><CheckCircle className="h-3.5 w-3.5 text-[hsl(var(--success))]" /></Button>
            )}
            {orig.status === "planned" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCancel(orig.id)} title="Cancelar"><Ban className="h-3.5 w-3.5 text-[hsl(var(--warning))]" /></Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleting(orig.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        );
      },
    },
  ];

  const handleCancel = (id: string) => {
    update.mutate({ id, status: "cancelled" } as any);
  };

  // Promove uma parcela legada (card_installments) abrindo o TransactionForm
  // pré-preenchido. Ao salvar (handleSubmit), também cancela a parcela origem
  // para evitar duplicidade nas Faturas Projetadas.
  const promotingInstallmentRef = useRef<string | null>(null);
  const handlePromoteInstallment = (r: UnifiedRow) => {
    const realId = r.id.replace("ci_", "");
    promotingInstallmentRef.current = realId;
    const draft: Partial<Transaction> = {
      description: r.description,
      transaction_type: "expense",
      amount: r.amount,
      competence_date: r.competence_date,
      due_date: r.due_date,
      status: r.status === "paid" ? "paid" : "planned",
      payment_date: null,
      category_id: r.category_id ?? null,
      financial_entity_id: r.financial_entity_id,
      account_id: null,
      payee: r.payee ?? null,
      notes: r.notes ?? null,
      installment_number: r.installment_number,
      installment_total: r.installment_total,
      card_id: r.card_id ?? null,
    } as any;
    setEditing(draft as Transaction);
    setFormOpen(true);
  };

  const ensureSavedRecordVisible = (item: Partial<Transaction>) => {
    let adjusted = false;

    if (search && item.description && !item.description.toLowerCase().includes(search.toLowerCase())) {
      setSearch("");
      adjusted = true;
    }

    if (filterSource === "card") {
      setFilterSource("transactions");
      adjusted = true;
    }

    const recordMonth = item.due_date?.slice(0, 7) || item.competence_date?.slice(0, 7);
    if (filterMonth !== "all" && recordMonth && filterMonth !== recordMonth) {
      setFilterMonth(recordMonth);
      adjusted = true;
    }

    if (filterStatus !== "all" && item.status && filterStatus !== item.status) {
      setFilterStatus("all");
      adjusted = true;
    }

    if (filterTypeTab !== "all" && item.transaction_type && filterTypeTab !== item.transaction_type) {
      setFilterTypeTab("all");
      adjusted = true;
    }

    if (filterEntity !== "all" && filterEntity !== "all_personal" && filterEntity !== "all_business" && item.financial_entity_id && filterEntity !== item.financial_entity_id) {
      setFilterEntity("all");
      adjusted = true;
    }

    if (filterAccount !== "all" && item.account_id !== filterAccount) {
      setFilterAccount("all");
      adjusted = true;
    }

    if (filterCategory !== "all" && item.category_id !== filterCategory) {
      setFilterCategory("all");
      adjusted = true;
    }

    if (adjusted) {
      toast.info("Ajustei os filtros para exibir o lançamento salvo.");
    }
  };

  const handleRepeatLast = () => {
    if (lastSavedRef.current) {
      const last = { ...lastSavedRef.current };
      delete (last as any).id;
      delete (last as any).created_at;
      delete (last as any).updated_at;
      last.status = "planned";
      last.payment_date = null;
      last.competence_date = format(new Date(), "yyyy-MM") + "-01";
      setEditing(last as any);
    } else {
      setEditing(null);
    }
    setFormOpen(true);
  };

  const handleSubmit = (d: Partial<Transaction>) => {
    const mutation = d.id ? update : create;
    mutation.mutate(d as any, {
      onSuccess: () => {
        lastSavedRef.current = d as Transaction;
        ensureSavedRecordVisible(d);
        // Se estávamos promovendo uma parcela legada, cancela a origem para evitar duplicidade.
        const promotingId = promotingInstallmentRef.current;
        if (promotingId && !d.id) {
          updateInstallmentStatus.mutate({ id: promotingId, status: "cancelled" });
          promotingInstallmentRef.current = null;
        }
        setFormOpen(false);
        setEditing(null);
      },
    });
  };

  // Batch actions
  const handleBatchStatus = useCallback((newStatus: string) => {
    const txIds = [...selectedKeys].filter(k => !k.startsWith("ci_"));
    if (txIds.length === 0) {
      toast.info("Nenhum lançamento editável selecionado.");
      return;
    }
    let done = 0;
    txIds.forEach(id => {
      update.mutate({ id, status: newStatus } as any, {
        onSuccess: () => {
          done++;
          if (done === txIds.length) {
            toast.success(`${done} lançamento(s) atualizado(s)`);
            setSelectedKeys(new Set());
          }
        },
      });
    });
  }, [selectedKeys, update]);

  const handleBatchDelete = useCallback(() => {
    const txIds = [...selectedKeys].filter(k => !k.startsWith("ci_"));
    if (txIds.length === 0) {
      toast.info("Nenhum lançamento editável selecionado.");
      return;
    }
    let done = 0;
    txIds.forEach(id => {
      remove.mutate(id, {
        onSuccess: () => {
          done++;
          if (done === txIds.length) {
            toast.success(`${done} lançamento(s) excluído(s)`);
            setSelectedKeys(new Set());
          }
        },
      });
    });
  }, [selectedKeys, remove]);

  return (
    <AppLayout>
      <PageHeader title="Lançamentos" description="Gerencie receitas e despesas" actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />Importar CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleRepeatLast} title="Repetir último lançamento salvo">
            <Copy className="h-4 w-4 mr-1" />Repetir último
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
      } />

      <Tabs value={filterTypeTab} onValueChange={setFilterTypeTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="transfer">Transferências</TabsTrigger>
        </TabsList>
      </Tabs>

      {filterEntity !== "all" && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">Visualizando:</span>
          {filterEntity === "all_personal" && <Badge variant="outline" className="border-primary text-primary">Pessoal</Badge>}
          {filterEntity === "all_business" && <Badge variant="outline" className="border-accent-foreground text-accent-foreground">Empresa</Badge>}
          {filterEntity !== "all_personal" && filterEntity !== "all_business" && (
            <Badge variant="outline">{entities.find(e => e.id === filterEntity)?.name}</Badge>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 mb-4 space-y-3">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por descrição, cartão, parcela, valor, observação..."
          hasActiveFilters={filterMonth !== "all" || filterSource !== "all" || filterCardInvoice !== "all" || filterStatus !== "all" || filterEntity !== "all" || filterAccount !== "all" || filterCategory !== "all" || filterCard !== "all" || filterInstallment !== "all"}
          onClear={() => { setFilterMonth("all"); setFilterSource("all"); setFilterCardInvoice("all"); setFilterStatus("all"); setFilterEntity("all"); setFilterAccount("all"); setFilterCategory("all"); setFilterCard("all"); setFilterInstallment("all"); }}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Mês</label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Origem</label>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (Lanç. + Cartão)</SelectItem>
                <SelectItem value="transactions">Somente Lançamentos</SelectItem>
                <SelectItem value="card">Somente Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fatura</label>
            <Select value={filterCardInvoice} onValueChange={setFilterCardInvoice}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Fatura" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="card_invoice">Todas Faturas</SelectItem>
                <SelectItem value="bra_pessoal">BRA Pessoal</SelectItem>
                <SelectItem value="nu_infotkt">Nu Infotkt</SelectItem>
                <SelectItem value="non_card_invoice">Outros lançamentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="planned">Previsto</SelectItem>
                <SelectItem value="paid">Realizado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Entidade</label>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Entidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas entidades</SelectItem>
                <SelectItem value="all_personal">Todas Pessoais</SelectItem>
                <SelectItem value="all_business">Todas Empresariais</SelectItem>
                {personalEntities.length > 0 && (
                  <>
                    <SelectItem value="__personal_header" disabled className="text-xs font-semibold text-muted-foreground">— Pessoais —</SelectItem>
                    {personalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </>
                )}
                {businessEntities.length > 0 && (
                  <>
                    <SelectItem value="__business_header" disabled className="text-xs font-semibold text-muted-foreground">— Empresariais —</SelectItem>
                    {businessEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Conta</label>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas contas</SelectItem>
                {filteredAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Categoria</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cartão</label>
            <Select value={filterCard} onValueChange={setFilterCard}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Cartão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos cartões</SelectItem>
                {cardsList.filter((c: any) => c.is_active !== false).map(c => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Parcelado</label>
            <Select value={filterInstallment} onValueChange={setFilterInstallment}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Parcelado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Parcelado</SelectItem>
                <SelectItem value="no">Não parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted border border-border">
          <span className="text-xs font-medium">{selectedKeys.size} selecionado(s)</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBatchStatus("paid")}>
            <CheckCircle className="h-3.5 w-3.5 mr-1" />Marcar Realizado
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBatchStatus("cancelled")}>
            <Ban className="h-3.5 w-3.5 mr-1" />Cancelar
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleBatchDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedKeys(new Set())}>Limpar seleção</Button>
        </div>
      )}

      <div className="grid gap-3 mb-4 md:grid-cols-3">
        <StatCard
          title="Quantidade"
          value={String(listSummary.count)}
          icon={List}
          subLabel="Lançamentos exibidos"
        />
        <StatCard
          title="Receitas"
          value={fmt(listSummary.income)}
          icon={ArrowUpCircle}
          subLabel="Total filtrado em tela"
          variant="positive"
        />
        <StatCard
          title="Despesas"
          value={fmt(listSummary.expense)}
          icon={ArrowDownCircle}
          subLabel="Total filtrado em tela"
          variant="negative"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading || loadingCI}
        emptyMessage="Nenhum lançamento encontrado."
        defaultSortKey="due_date"
        defaultSortDir="asc"
        className="text-xs [&_th]:text-xs [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-1.5"
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        rowKey={(r) => r.id}
      />

      <TransactionForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        transaction={editing}
        entities={entities}
        accounts={accounts}
        categories={categories}
        onSubmit={handleSubmit}
        loading={create.isPending || update.isPending}
      />

      <DeleteDialog open={!!deleting} onOpenChange={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting, { onSuccess: () => setDeleting(null) }); }} loading={remove.isPending} />

      <DeleteDialog
        open={!!deletingInstallment}
        onOpenChange={() => setDeletingInstallment(null)}
        onConfirm={() => {
          if (deletingInstallment) {
            updateInstallmentStatus.mutate(
              { id: deletingInstallment, status: "cancelled" },
              { onSuccess: () => setDeletingInstallment(null) }
            );
          }
        }}
        loading={updateInstallmentStatus.isPending}
      />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["transactions"] })}
      />

      <PaymentDialog
        transaction={settling}
        open={!!settling}
        onOpenChange={(o) => { if (!o) setSettling(null); }}
        onConfirm={(data) => {
          update.mutate(data as any, { onSuccess: () => setSettling(null) });
        }}
        onCreateRemainder={(remainder) => {
          create.mutate(remainder as any);
        }}
        loading={update.isPending}
      />
    </AppLayout>
  );
}
