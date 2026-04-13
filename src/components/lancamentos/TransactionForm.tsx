import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useCategories } from "@/hooks/useCategories";
import { useCards } from "@/hooks/useCards";
import type { Transaction, FinancialEntity, Account, Category } from "@/types/database";

const schema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  transaction_type: z.string().min(1, "Tipo é obrigatório"),
  category_id: z.string().optional().nullable(),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  account_id: z.string().optional().nullable(),
  amount: z.string().min(1, "Valor é obrigatório"),
  competence_date: z.string().min(1, "Competência é obrigatória"),
  due_date: z.date().optional().nullable(),
  payment_date: z.date().optional().nullable(),
  status: z.string().min(1, "Status é obrigatório"),
  payee: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  center_cost: z.string().optional().nullable(),
  installment_number: z.coerce.number().min(1).optional().nullable(),
  installment_total: z.coerce.number().min(1).optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  entities: FinancialEntity[];
  accounts: Account[];
  categories: Category[];
  onSubmit: (data: Partial<Transaction>) => void;
  loading?: boolean;
}

export function TransactionForm({ open, onOpenChange, transaction, entities, accounts, categories, onSubmit, loading }: Props) {
  const { create: createCategory } = useCategories();
  const { data: cardsList = [] } = useCards();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "", transaction_type: "expense", category_id: "", financial_entity_id: "",
      account_id: "", amount: "", competence_date: format(new Date(), "yyyy-MM"), due_date: null, payment_date: null,
      status: "planned", payee: "", notes: "", center_cost: "",
      installment_number: 1, installment_total: 1,
    },
  });

  const watchAccountId = form.watch("account_id");

  useEffect(() => {
    if (watchAccountId && watchAccountId !== "none" && watchAccountId !== "") {
      const account = accounts.find(a => a.id === watchAccountId);
      if (account?.financial_entity_id) {
        form.setValue("financial_entity_id", account.financial_entity_id);
      }
    }
  }, [watchAccountId, accounts, form]);

  useEffect(() => {
    if (transaction) {
      form.reset({
        description: transaction.description,
        transaction_type: transaction.transaction_type,
        category_id: transaction.category_id || "",
        financial_entity_id: transaction.financial_entity_id,
        account_id: transaction.account_id || "",
        amount: String(transaction.amount),
        competence_date: transaction.competence_date.substring(0, 7),
        due_date: transaction.due_date
          ? (() => { const [y, m, d] = transaction.due_date.split('-').map(Number); return new Date(y, m - 1, d); })()
          : null,
        payment_date: (transaction.status === "paid" && transaction.payment_date)
          ? (() => { const [y, m, d] = transaction.payment_date.split('-').map(Number); return new Date(y, m - 1, d); })()
          : null,
        status: transaction.status,
        payee: (transaction as any).payee || "",
        notes: transaction.notes || "",
        center_cost: (transaction as any).center_cost || "",
        installment_number: transaction.installment_number ?? 1,
        installment_total: transaction.installment_total ?? 1,
      });
    } else {
      form.reset({
        description: "", transaction_type: "expense", category_id: "", financial_entity_id: "",
        account_id: "", amount: "", competence_date: format(new Date(), "yyyy-MM"), due_date: null, payment_date: null,
        status: "planned", payee: "", notes: "", center_cost: "",
        installment_number: 1, installment_total: 1,
      });
    }
    setCreatingCategory(false);
    setNewCategoryName("");
  }, [transaction, open]);

  const handleSubmit = (data: FormData) => {
    const parsedAmount = parseFloat(String(data.amount).replace(/\./g, "").replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      form.setError("amount", { message: "Valor inválido" });
      return;
    }
    const cleanId = (v: string | null | undefined) => (v && v !== "none" && v !== "") ? v : null;
    const payload: any = {
      description: data.description,
      transaction_type: data.transaction_type,
      status: data.status,
      financial_entity_id: data.financial_entity_id,
      category_id: cleanId(data.category_id),
      account_id: cleanId(data.account_id),
      payee: data.payee || null,
      notes: data.notes || null,
      amount: parsedAmount,
      competence_date: data.competence_date + "-01",
      due_date: data.due_date ? format(data.due_date, "yyyy-MM-dd") : null,
      payment_date: (data.status === "paid") && data.payment_date ? format(data.payment_date, "yyyy-MM-dd") : null,
      installment_number: data.installment_number || 1,
      installment_total: data.installment_total || 1,
    };
    onSubmit(transaction ? { id: transaction.id, ...payload } : payload);
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategory.mutate({ name: newCategoryName.trim(), is_active: true } as any, {
      onSuccess: () => {
        setCreatingCategory(false);
        setNewCategoryName("");
      },
    });
  };

  const personalEntities = entities.filter(e => e.is_active && e.entity_type === "personal");
  const businessEntities = entities.filter(e => e.is_active && e.entity_type === "business");

  const DateField = ({ name, label }: { name: "due_date" | "payment_date"; label: string }) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex flex-col">
        <FormLabel>{label}</FormLabel>
        <div className="flex gap-1 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                  {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecione...</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          {field.value && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => field.onChange(null)} title="Limpar data">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <FormMessage />
      </FormItem>
    )} />
  );

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={transaction ? "Editar Lançamento" : "Novo Lançamento"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Descrição *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="payee" render={({ field }) => (
            <FormItem><FormLabel>Favorecido/Cliente</FormLabel><FormControl><Input placeholder="Nome do favorecido ou cliente" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="transaction_type" render={({ field }) => (
              <FormItem><FormLabel>Tipo *</FormLabel><FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status *</FormLabel><FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Previsto</SelectItem>
                    <SelectItem value="paid">Realizado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl><FormMessage /></FormItem>
            )} />
          </div>

          {/* Categoria com criação inline */}
          <FormField control={form.control} name="category_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categories.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormControl>
              {!creatingCategory ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1 px-1" onClick={() => setCreatingCategory(true)}>
                  <PlusCircle className="h-3 w-3" /> Nova categoria
                </Button>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Nome da categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(); } }}
                  />
                  <Button type="button" size="sm" className="h-8 text-xs" onClick={handleCreateCategory} disabled={createCategory.isPending}>Criar</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setCreatingCategory(false); setNewCategoryName(""); }}>✕</Button>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="account_id" render={({ field }) => (
            <FormItem><FormLabel>Conta</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {accounts.filter(a => a.is_active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="financial_entity_id" render={({ field }) => (
            <FormItem><FormLabel>Entidade Financeira *</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {personalEntities.length > 0 && (
                    <>
                      <SelectItem value="__p_hdr" disabled className="text-xs font-semibold text-muted-foreground">— Pessoais —</SelectItem>
                      {personalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </>
                  )}
                  {businessEntities.length > 0 && (
                    <>
                      <SelectItem value="__b_hdr" disabled className="text-xs font-semibold text-muted-foreground">— Empresariais —</SelectItem>
                      {businessEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
          )} />

          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem><FormLabel>Valor *</FormLabel><FormControl><Input type="text" inputMode="decimal" placeholder="0,00" {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          {/* Parcela */}
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="installment_number" render={({ field }) => (
              <FormItem><FormLabel>Parcela Nº</FormLabel><FormControl><Input type="number" min={1} {...field} value={field.value ?? 1} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="installment_total" render={({ field }) => (
              <FormItem><FormLabel>Total Parcelas</FormLabel><FormControl><Input type="number" min={1} {...field} value={field.value ?? 1} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField control={form.control} name="competence_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Mês do Evento *</FormLabel>
                <FormControl>
                  <Input type="month" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DateField name="due_date" label="Vencimento" />
            <DateField name="payment_date" label="Pagamento" />
          </div>

          <FormField control={form.control} name="center_cost" render={({ field }) => (
            <FormItem><FormLabel>Cartão de Crédito</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cardsList.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl>
            <span className="text-xs text-muted-foreground">Selecione se este lançamento é pagamento de fatura de cartão</span>
            </FormItem>
          )} />

          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />

          <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
        </form>
      </Form>
    </FormDrawer>
  );
}
