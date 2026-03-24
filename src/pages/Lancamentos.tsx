import { useState, useMemo } from "react";
import { format, subMonths, addMonths, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Ban, CreditCard, CheckCircle } from "lucide-react";
import { isCardInvoiceByCenterCost, getCardNameFromCenterCost, isCardInvoice, getCardInvoiceLabel } from "@/lib/cardInvoiceRules";
import { useTransactions } from "@/hooks/useTransactions";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { TransactionForm } from "@/components/lancamentos/TransactionForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import { PaymentDialog } from "@/components/lancamentos/PaymentDialog";
import type { Transaction } from "@/types/database";

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Realizado</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelado</Badge>;
  // Both "pending" and "planned" = Previsto
  return <Badge variant="outline" className="border-[hsl(var(--warning))] text-[hsl(var(--warning))]">Previsto</Badge>;
}

function TypeBadge({ type }: { type: string }) {
  if (type === "income") return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Receita</Badge>;
  if (type === "transfer") return <Badge variant="secondary">Transferência</Badge>;
  return <Badge variant="destructive">Despesa</Badge>;
}

function EntityTypeBadge({ entityType }: { entityType?: string }) {
  if (entityType === "personal") return <Badge variant="outline" className="text-xs border-primary text-primary">Pessoal</Badge>;
  if (entityType === "business") return <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">Empresa</Badge>;
  return null;
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
  const { data = [], isLoading, create, update, remove } = useTransactions();
  const { data: entities = [] } = useFinancialEntities();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const [searchParams] = useSearchParams();
  const initialMonth = searchParams.get("mes") || format(new Date(), "yyyy-MM");

  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState(initialMonth);
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTypeTab, setFilterTypeTab] = useState("all");
  const [filterCardInvoice, setFilterCardInvoice] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settling, setSettling] = useState<Transaction | null>(null);

  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities.forEach(e => map.set(e.id, e.entity_type));
    return map;
  }, [entities]);

  const personalEntities = useMemo(() => entities.filter(e => e.entity_type === "personal"), [entities]);
  const businessEntities = useMemo(() => entities.filter(e => e.entity_type === "business"), [entities]);
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const filtered = useMemo(() => {
    return data.filter((t) => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterEntity !== "all" && t.financial_entity_id !== filterEntity) return false;
      if (filterAccount !== "all" && t.account_id !== filterAccount) return false;
      if (filterCategory !== "all" && t.category_id !== filterCategory) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterTypeTab !== "all" && t.transaction_type !== filterTypeTab) return false;
      const isCCInvoice = isCardInvoiceByCenterCost((t as any).center_cost) || isCardInvoice(t.categories?.name);
      if (filterCardInvoice === "card_invoice" && !isCCInvoice) return false;
      if (filterCardInvoice === "non_card_invoice" && isCCInvoice) return false;
      if (filterMonth !== "all") {
        const monthStart = filterMonth + "-01";
        const [y, m] = filterMonth.split("-").map(Number);
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
        if (t.competence_date < monthStart || t.competence_date >= nextMonth) return false;
      }
      return true;
    });
  }, [data, search, filterEntity, filterAccount, filterCategory, filterStatus, filterTypeTab, filterCardInvoice, filterMonth]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d: string | null) => d ? format(parseISO(d), "dd/MM/yyyy") : "—";

  const resolveStatus = (r: Transaction) => r.status;

  const columns: Column<Transaction>[] = [
    { key: "due_date", header: "Vencimento", sortable: true, sortValue: (r) => r.due_date || "", render: (r) => fmtDate(r.due_date) },
    {
      key: "description", header: "Descrição", sortable: true, sortValue: (r) => r.description.toLowerCase(),
      render: (r) => {
        const isCCInvoice = isCardInvoiceByCenterCost((r as any).center_cost) || isCardInvoice(r.categories?.name);
        if (isCCInvoice) {
          const cardLabel = getCardNameFromCenterCost((r as any).center_cost) || getCardInvoiceLabel(r.categories?.name || "");
          return (
            <div className="flex items-center gap-1.5">
              <span>{r.description}</span>
              <Badge variant="outline" className="text-xs border-primary text-primary gap-1">
                <CreditCard className="h-3 w-3" />{cardLabel || "Fatura"}
              </Badge>
            </div>
          );
        }
        return r.description;
      },
    },
    { key: "transaction_type", header: "Tipo", sortable: true, sortValue: (r) => r.transaction_type, render: (r) => <TypeBadge type={r.transaction_type} /> },
    {
      key: "category", header: "Categoria", sortable: true, sortValue: (r) => r.categories?.name || "",
      render: (r) => {
        const catName = r.categories?.name;
        const cardLabel = catName ? getCardInvoiceLabel(catName) : "";
        return (
          <div className="flex items-center gap-1.5">
            <span>{catName || "—"}</span>
            {cardLabel && <Badge variant="secondary" className="text-xs">{cardLabel}</Badge>}
          </div>
        );
      },
    },
    {
      key: "entity", header: "Entidade", sortable: true, sortValue: (r) => r.financial_entities?.name || "",
      render: (r) => {
        const entityType = (r.financial_entities as any)?.entity_type;
        if (!entityType) return "—";
        return <EntityTypeBadge entityType={entityType} />;
      },
    },
    { key: "account", header: "Conta", sortable: true, sortValue: (r) => r.accounts?.name || "", render: (r) => r.accounts?.name || "—" },
    { key: "amount", header: "Valor", sortable: true, sortValue: (r) => r.amount, render: (r) => <span className={r.transaction_type === "income" ? "text-[hsl(var(--success))]" : "text-foreground"}>{fmt(r.amount)}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => resolveStatus(r), render: (r) => <StatusBadge status={resolveStatus(r)} /> },
    {
      key: "actions", header: "Ações", render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          {(r.status === "planned" || r.status === "pending") && (
            <Button variant="ghost" size="icon" onClick={() => setSettling(r)} title="Registrar baixa"><CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" /></Button>
          )}
          {(r.status === "planned" || r.status === "pending") && (
            <Button variant="ghost" size="icon" onClick={() => handleCancel(r.id)} title="Cancelar"><Ban className="h-4 w-4 text-[hsl(var(--warning))]" /></Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setDeleting(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const handleCancel = (id: string) => {
    update.mutate({ id, status: "cancelled" } as any);
  };

  const handleSubmit = (d: Partial<Transaction>) => {
    const mutation = d.id ? update : create;
    mutation.mutate(d as any, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
  };

  return (
    <AppLayout>
      <PageHeader title="Lançamentos" description="Gerencie receitas e despesas" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      } />

      <Tabs value={filterTypeTab} onValueChange={setFilterTypeTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="transfer">Transferências</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar lançamento...">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCardInvoice} onValueChange={setFilterCardInvoice}>
          <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Fatura" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="card_invoice">Faturas de Cartão</SelectItem>
            <SelectItem value="non_card_invoice">Outros lançamentos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="planned">Previsto</SelectItem>
            <SelectItem value="paid">Realizado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
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
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Conta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas contas</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered as any}
        loading={isLoading}
        emptyMessage="Nenhum lançamento encontrado."
        defaultSortKey="due_date"
        defaultSortDir="asc"
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

      <PaymentDialog
        transaction={settling}
        open={!!settling}
        onOpenChange={(o) => { if (!o) setSettling(null); }}
        onConfirm={(data) => {
          update.mutate(data as any, { onSuccess: () => setSettling(null) });
        }}
        loading={update.isPending}
      />
    </AppLayout>
  );
}
