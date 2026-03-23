import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { Transaction, FinancialEntity, Account, Category } from "@/types/database";

const schema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  transaction_type: z.string().min(1, "Tipo é obrigatório"),
  category_id: z.string().optional().nullable(),
  financial_entity_id: z.string().min(1, "Entidade é obrigatória"),
  account_id: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  competence_date: z.string().min(1, "Competência é obrigatória"),
  due_date: z.date().optional().nullable(),
  payment_date: z.date().optional().nullable(),
  status: z.string().min(1, "Status é obrigatório"),
  notes: z.string().max(500).optional().nullable(),
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
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "", transaction_type: "expense", category_id: "", financial_entity_id: "",
      account_id: "", amount: "", competence_date: format(new Date(), "yyyy-MM"), due_date: null, payment_date: null,
      status: "planned", notes: "",
    },
  });

  const watchAccountId = form.watch("account_id");

  // Auto-fill entity when account is selected
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
        amount: transaction.amount,
        competence_date: new Date(transaction.competence_date),
        due_date: transaction.due_date ? new Date(transaction.due_date) : null,
        payment_date: transaction.payment_date ? new Date(transaction.payment_date) : null,
        status: transaction.status,
        notes: transaction.notes || "",
      });
    } else {
      form.reset({
        description: "", transaction_type: "expense", category_id: "", financial_entity_id: "",
        account_id: "", amount: 0, competence_date: new Date(), due_date: null, payment_date: null,
        status: "planned", notes: "",
      });
    }
  }, [transaction, open]);

  const handleSubmit = (data: FormData) => {
    const payload: any = {
      ...data,
      category_id: data.category_id || null,
      account_id: data.account_id || null,
      notes: data.notes || null,
      competence_date: format(data.competence_date, "yyyy-MM-dd"),
      due_date: data.due_date ? format(data.due_date, "yyyy-MM-dd") : null,
      payment_date: data.payment_date ? format(data.payment_date, "yyyy-MM-dd") : null,
    };
    onSubmit(transaction ? { id: transaction.id, ...payload } : payload);
  };

  const personalEntities = entities.filter(e => e.is_active && e.entity_type === "personal");
  const businessEntities = entities.filter(e => e.is_active && e.entity_type === "business");

  const DateField = ({ name, label }: { name: "competence_date" | "due_date" | "payment_date"; label: string }) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex flex-col">
        <FormLabel>{label}</FormLabel>
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

          <FormField control={form.control} name="category_id" render={({ field }) => (
            <FormItem><FormLabel>Categoria</FormLabel><FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormControl><FormMessage /></FormItem>
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
            <FormItem><FormLabel>Valor *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DateField name="competence_date" label="Competência *" />
            <DateField name="due_date" label="Vencimento" />
            <DateField name="payment_date" label="Pagamento" />
          </div>

          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
          )} />

          <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
        </form>
      </Form>
    </FormDrawer>
  );
}
