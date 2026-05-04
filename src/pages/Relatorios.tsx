import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileSpreadsheet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinancialEntities } from "@/hooks/useFinancialEntities";
import { useCategories } from "@/hooks/useCategories";
import { useCardPurchases } from "@/hooks/useCardPurchases";
import { useCards } from "@/hooks/useCards";
import { useInvestmentSnapshots } from "@/hooks/useInvestments";
import { usePatrimonySnapshots } from "@/hooks/usePatrimony";
import { exportToFile } from "@/lib/exportUtils";

const fmtDate = (d: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy") : "");
const fmtMoney = (v: number | null) => (v != null ? v.toFixed(2) : "");
const fmtMonth = (d: string | null) => (d ? format(parseISO(d + (d.length === 7 ? "-01" : "")), "MM/yyyy") : "");

function generateMonthOptions() {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -12; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = format(d, "yyyy-MM");
    const label = format(d, "MMM/yyyy", { locale: ptBR });
    months.push({ value: val, label });
  }
  return months;
}

export default function Relatorios() {
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Filters
  const [txMonth, setTxMonth] = useState("all");
  const [txAccount, setTxAccount] = useState("all");
  const [txStatus, setTxStatus] = useState("all");
  const [txEntity, setTxEntity] = useState("all");
  const [txCategory, setTxCategory] = useState("all");
  const [cardMonth, setCardMonth] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");

  // Data
  const { data: transactions = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const { data: entities = [] } = useFinancialEntities();
  const { data: categories = [] } = useCategories();
  const { data: cardPurchases = [] } = useCardPurchases();
  const { data: cards = [] } = useCards();
  const { data: investments = [] } = useInvestmentSnapshots();
  const { data: patrimony = [] } = usePatrimonySnapshots();

  // Recurrences query
  const [recurrences, setRecurrences] = useState<any[]>([]);
  const [recLoaded, setRecLoaded] = useState(false);

  const loadRecurrences = async () => {
    if (recLoaded) return;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await (supabase as any).from("recurrences").select("*").order("description");
    setRecurrences(data || []);
    setRecLoaded(true);
  };

  const statusLabel = (s: string) =>
    s === "paid" ? "Realizado" : s === "planned" ? "Previsto" : s === "cancelled" ? "Cancelado" : (s ?? "");

  // Filtered transactions
  const filteredTx = useMemo(() => {
    let result = [...transactions];
    if (txMonth !== "all") result = result.filter((t: any) => t.competence_date?.startsWith(txMonth));
    if (txAccount !== "all") result = result.filter((t: any) => t.account_id === txAccount);
    if (txStatus !== "all") result = result.filter((t: any) => t.status === txStatus);
    if (txEntity !== "all") result = result.filter((t: any) => t.financial_entity_id === txEntity);
    if (txCategory !== "all") result = result.filter((t: any) => t.category_id === txCategory);
    return result;
  }, [transactions, txMonth, txAccount, txStatus, txEntity, txCategory]);

  // Filtered card purchases
  const filteredCards = useMemo(() => {
    let result = [...cardPurchases];
    if (cardMonth !== "all") result = result.filter((c: any) => c.purchase_date?.startsWith(cardMonth));
    if (cardFilter !== "all") result = result.filter((c: any) => c.card_id === cardFilter);
    return result;
  }, [cardPurchases, cardMonth, cardFilter]);

  const exportTx = useMemo(
    () =>
      filteredTx.map((t: any) => ({
        due_date_fmt: fmtDate(t.due_date),
        payment_date_fmt: fmtDate(t.payment_date),
        description: t.description ?? "",
        type_label:
          t.transaction_type === "income"
            ? "Receita"
            : t.transaction_type === "expense"
            ? "Despesa"
            : t.transaction_type ?? "",
        payee: t.payee ?? "",
        category_name: t.categories?.name ?? "",
        entity_name: t.financial_entities?.name ?? "",
        account_name: t.accounts?.name ?? "",
        card_name: t.cards?.name ?? "",
        status_label: statusLabel(t.status),
        receita: t.transaction_type === "income" ? Number(t.amount) : "",
        despesa: t.transaction_type === "expense" ? Number(t.amount) : "",
      })),
    [filteredTx]
  );

  const txColumns = [
    { key: "due_date_fmt", header: "Vencimento" },
    { key: "payment_date_fmt", header: "Data Pagamento" },
    { key: "description", header: "Descrição" },
    { key: "type_label", header: "Tipo" },
    { key: "payee", header: "Favorecido" },
    { key: "category_name", header: "Categoria" },
    { key: "entity_name", header: "Entidade" },
    { key: "account_name", header: "Conta" },
    { key: "card_name", header: "Cartão" },
    { key: "status_label", header: "Status" },
    { key: "receita", header: "Receita" },
    { key: "despesa", header: "Despesa" },
  ];

  const cardColumns = [
    { key: "purchase_date", header: "Data Compra" },
    { key: "description", header: "Descrição" },
    { key: "cards.name", header: "Cartão" },
    { key: "categories.name", header: "Categoria" },
    { key: "financial_entities.name", header: "Entidade" },
    { key: "total_amount", header: "Valor Total" },
    { key: "installments", header: "Parcelas" },
    { key: "installment_value", header: "Valor Parcela" },
    { key: "status", header: "Status" },
  ];

  const investmentColumns = [
    { key: "reference_month", header: "Mês Referência" },
    { key: "investment_classes.name", header: "Classe" },
    { key: "financial_entities.name", header: "Entidade" },
    { key: "opening_value", header: "Valor Abertura" },
    { key: "closing_value", header: "Valor Fechamento" },
  ];

  const patrimonyColumns = [
    { key: "reference_month", header: "Mês Referência" },
    { key: "item_name", header: "Item" },
    { key: "asset_categories.name", header: "Categoria" },
    { key: "asset_categories.asset_type", header: "Tipo Ativo" },
    { key: "financial_entities.name", header: "Entidade" },
    { key: "opening_value", header: "Valor Abertura" },
    { key: "closing_value", header: "Valor Fechamento" },
  ];

  const recurrenceColumns = [
    { key: "description", header: "Descrição" },
    { key: "amount", header: "Valor" },
    { key: "frequency", header: "Frequência" },
    { key: "start_date", header: "Data Início" },
    { key: "end_date", header: "Data Fim" },
    { key: "is_active", header: "Ativo" },
    { key: "type", header: "Tipo" },
  ];

  const ExportButtons = ({
    data,
    columns,
    filename,
  }: {
    data: any[];
    columns: { key: string; header: string }[];
    filename: string;
  }) => (
    <div className="flex gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToFile(data, columns, filename, "csv")}
        disabled={data.length === 0}
      >
        <Download className="h-4 w-4 mr-1" /> CSV
      </Button>
      <Button
        size="sm"
        onClick={() => exportToFile(data, columns, filename, "xlsx")}
        disabled={data.length === 0}
      >
        <FileSpreadsheet className="h-4 w-4 mr-1" /> XLSX
      </Button>
      <span className="text-xs text-muted-foreground self-center ml-2">
        {data.length} registro(s)
      </span>
    </div>
  );

  return (
    <AppLayout>
      <PageHeader title="Relatórios" description="Exportação de dados do sistema" />

      <Card>
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            {/* 1. Lançamentos */}
            <AccordionItem value="transactions">
              <AccordionTrigger>Lançamentos</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <Select value={txMonth} onValueChange={setTxMonth}>
                    <SelectTrigger><SelectValue placeholder="Mês/Ano" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={txAccount} onValueChange={setTxAccount}>
                    <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as contas</SelectItem>
                      {accounts.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={txStatus} onValueChange={setTxStatus}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="planned">Planejado</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="overdue">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={txEntity} onValueChange={setTxEntity}>
                    <SelectTrigger><SelectValue placeholder="Entidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {entities.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={txCategory} onValueChange={setTxCategory}>
                    <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ExportButtons data={exportTx} columns={txColumns} filename="lancamentos" />
              </AccordionContent>
            </AccordionItem>

            {/* 2. Recorrências */}
            <AccordionItem value="recurrences">
              <AccordionTrigger onClick={loadRecurrences}>Recorrências</AccordionTrigger>
              <AccordionContent>
                <ExportButtons data={recurrences} columns={recurrenceColumns} filename="recorrencias" />
              </AccordionContent>
            </AccordionItem>

            {/* 3. Cartões */}
            <AccordionItem value="cards">
              <AccordionTrigger>Cartões</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Select value={cardMonth} onValueChange={setCardMonth}>
                    <SelectTrigger><SelectValue placeholder="Mês/Ano" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cardFilter} onValueChange={setCardFilter}>
                    <SelectTrigger><SelectValue placeholder="Cartão" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {cards.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ExportButtons data={filteredCards} columns={cardColumns} filename="cartoes" />
              </AccordionContent>
            </AccordionItem>

            {/* 4. Investimentos */}
            <AccordionItem value="investments">
              <AccordionTrigger>Investimentos</AccordionTrigger>
              <AccordionContent>
                <ExportButtons data={investments} columns={investmentColumns} filename="investimentos" />
              </AccordionContent>
            </AccordionItem>

            {/* 5. Patrimônio */}
            <AccordionItem value="patrimony">
              <AccordionTrigger>Patrimônio</AccordionTrigger>
              <AccordionContent>
                <ExportButtons data={patrimony} columns={patrimonyColumns} filename="patrimonio" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
