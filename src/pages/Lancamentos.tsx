import { useState, useMemo } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Pencil, Trash2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { TransactionForm } from "@/components/lancamentos/TransactionForm";
import { DeleteDialog } from "@/components/configuracoes/DeleteDialog";
import type { Transaction } from "@/types/database";

const statusLabels: Record<string, string> = { pending: "Previsto", paid: "Realizado", cancelled: "Cancelado" };

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

function EntityTypeBadge({ entityType }: { entityType?: string }) {
  if (entityType === "personal") return <Badge variant="outline" className="text-xs border-primary text-primary">Pessoal</Badge>;
  if (entityType === "business") return <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">Empresa</Badge>;
  return null;
}

export default function Lancamentos() {
  const { data = [], isLoading, create, update, remove } = useTransactions();
  const { data: entities = [] } = useFinancialEntities();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const entityMap = useMemo(() => {
    const map = new Map<string, string>();
    entities.forEach(e => map.set(e.id, e.entity_type));
    return map;
  }, [entities]);

  const personalEntities = useMemo(() => entities.filter(e => e.entity_type === "personal"), [entities]);
  const businessEntities = useMemo(() => entities.filter(e => e.entity_type === "business"), [entities]);

  const filtered = useMemo(() => {
    return data.filter((t) => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterEntity !== "all" && t.financial_entity_id !== filterEntity) return false;
      if (filterAccount !== "all" && t.account_id !== filterAccount) return false;
      if (filterCategory !== "all" && t.category_id !== filterCategory) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterType !== "all" && t.transaction_type !== filterType) return false;
      if (dateFrom) {
        const cd = new Date(t.competence_date);
        if (cd < dateFrom) return false;
      }
      if (dateTo) {
        const cd = new Date(t.competence_date);
        if (cd > dateTo) return false;
      }
      return true;
    });
  }, [data, search, filterEntity, filterAccount, filterCategory, filterStatus, filterType, dateFrom, dateTo]);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const columns: Column<Transaction>[] = [
    { key: "competence_date", header: "Data", render: (r) => fmtDate(r.competence_date) },
    { key: "description", header: "Descrição" },
    { key: "transaction_type", header: "Tipo", render: (r) => <TypeBadge type={r.transaction_type} /> },
    { key: "category", header: "Categoria", render: (r) => r.categories?.name || "—" },
    {
      key: "entity", header: "Entidade", render: (r) => (
        <div className="flex items-center gap-1.5">
          <span>{r.financial_entities?.name || "—"}</span>
          <EntityTypeBadge entityType={entityMap.get(r.financial_entity_id)} />
        </div>
      ),
    },
    { key: "account", header: "Conta", render: (r) => r.accounts?.name || "—" },
    { key: "amount", header: "Valor", render: (r) => <span className={r.transaction_type === "income" ? "text-[hsl(var(--success))]" : "text-foreground"}>{fmt(r.amount)}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "Ações", render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          {r.status !== "cancelled" && (
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

  const DateFilter = ({ value, onChange, placeholder }: { value?: Date; onChange: (d?: Date) => void; placeholder: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 w-[140px] justify-start text-left text-xs font-normal", !value && "text-muted-foreground")}>
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {value ? format(value, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={(d) => onChange(d ?? undefined)} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );

  return (
    <AppLayout>
      <PageHeader title="Lançamentos" description="Gerencie receitas e despesas" actions={
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      } />

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar lançamento...">
        <DateFilter value={dateFrom} onChange={setDateFrom} placeholder="De" />
        <DateFilter value={dateTo} onChange={setDateTo} placeholder="Até" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
            <SelectItem value="transfer">Transferência</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Previsto</SelectItem>
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

      <DataTable columns={columns} data={filtered as any} loading={isLoading} emptyMessage="Nenhum lançamento encontrado." />

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
    </AppLayout>
  );
}
