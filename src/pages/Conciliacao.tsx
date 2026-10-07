import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Info, Scale } from "lucide-react";
import { useReconciliationData } from "@/hooks/useReconciliation";
import { officialBalance, reconcileMonth, reconciliationCsv } from "@/lib/reconciliation";
import { formatIsoDateBR } from "@/lib/cardCycle";
import { evaluateExpression } from "@/lib/calc";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return format(new Date(y, mm - 1, 1), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
};

function buildMonths(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = -12; i <= 2; i++) out.push(format(addMonths(new Date(now.getFullYear(), now.getMonth(), 1), i), "yyyy-MM"));
  return out.reverse();
}

// Saldo do extrato informado pelo usuário: conveniência local, só neste navegador.
const STMT_KEY = "fh-conciliacao-extrato";
function loadStatements(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STMT_KEY) || "{}"); } catch { return {}; }
}
function saveStatements(v: Record<string, string>) {
  try { localStorage.setItem(STMT_KEY, JSON.stringify(v)); } catch { /* sem armazenamento */ }
}

export default function Conciliacao() {
  const { data, isLoading, error } = useReconciliationData();
  const months = useMemo(buildMonths, []);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [accountId, setAccountId] = useState<string>("");
  const [statements, setStatements] = useState<Record<string, string>>(loadStatements);

  useEffect(() => { saveStatements(statements); }, [statements]);
  useEffect(() => {
    if (!accountId && data?.accounts.length) setAccountId(data.accounts[0].id);
  }, [data, accountId]);

  const overview = useMemo(() => {
    if (!data) return [];
    return data.accounts.map((a) => {
      const txs = data.byAccount.get(a.id) || [];
      const r = reconcileMonth(a, txs, month);
      const official = officialBalance(a, txs);
      const stmtRaw = statements[`${a.id}_${month}`];
      const stmt = stmtRaw ? evaluateExpression(stmtRaw) : null;
      return { account: a, r, official, appDiff: Math.round((a.current_balance - official) * 100) / 100, stmt, stmtDiff: stmt !== null ? Math.round((r.endBalance - stmt) * 100) / 100 : null };
    });
  }, [data, month, statements]);

  const selected = overview.find((o) => o.account.id === accountId);

  const setStatement = (accId: string, v: string) => setStatements((prev) => ({ ...prev, [`${accId}_${month}`]: v }));

  const exportCsv = () => {
    if (!selected) return;
    const blob = new Blob(["﻿" + reconciliationCsv(selected.account.name, selected.r)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conciliacao-${selected.account.name.replace(/\W+/g, "-")}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <PageHeader title="Conciliação Bancária" description="Saldo de cada conta mês a mês, lançamento por lançamento, para conferir com o extrato" />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs">Mês</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 max-w-xl">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Regra oficial: saldo = abertura + lançamentos pagos com data efetiva (pagamento, senão competência, senão vencimento) após a data-base da conta.
        </p>
      </div>

      {error && <p className="text-sm text-destructive mb-4">Não foi possível carregar os dados: {(error as Error).message}</p>}

      {/* Visão geral: todas as contas no mês */}
      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Todas as contas · {monthLabel(month)}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p> : (
            <table className="w-full text-sm min-w-[860px]">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="text-left py-2">Conta</th>
                  <th className="text-right py-2">Saldo inicial</th>
                  <th className="text-right py-2">Entradas</th>
                  <th className="text-right py-2">Saídas</th>
                  <th className="text-right py-2">Saldo final</th>
                  <th className="text-right py-2 pl-3">Saldo do extrato</th>
                  <th className="text-right py-2">Diferença</th>
                  <th className="text-left py-2 pl-3">Saldo do app</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((o) => (
                  <tr key={o.account.id} className={`border-b cursor-pointer hover:bg-muted/40 ${o.account.id === accountId ? "bg-primary/5" : ""}`} onClick={() => setAccountId(o.account.id)}>
                    <td className="py-2 font-medium">{o.account.name}</td>
                    <td className="py-2 text-right font-mono">{o.r.beforeOpening ? "—" : fmt(o.r.startBalance)}</td>
                    <td className="py-2 text-right font-mono text-emerald-600">{fmt(o.r.inflow)}</td>
                    <td className="py-2 text-right font-mono text-destructive">{fmt(o.r.outflow)}</td>
                    <td className="py-2 text-right font-mono font-semibold">{o.r.beforeOpening ? "—" : fmt(o.r.endBalance)}</td>
                    <td className="py-2 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Input
                        id={`stmt-${o.account.id}`}
                        value={statements[`${o.account.id}_${month}`] ?? ""}
                        onChange={(e) => setStatement(o.account.id, e.target.value)}
                        placeholder="ex.: -3.872,55"
                        className="h-7 w-32 text-xs text-right font-mono ml-auto"
                      />
                    </td>
                    <td className={`py-2 text-right font-mono ${o.stmtDiff === null ? "text-muted-foreground" : o.stmtDiff === 0 ? "text-emerald-600" : "text-destructive font-semibold"}`}>
                      {o.stmtDiff === null ? "—" : o.stmtDiff === 0 ? "Confere" : fmt(o.stmtDiff)}
                    </td>
                    <td className="py-2 pl-3 text-xs">
                      {o.appDiff === 0
                        ? <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">Regra oficial ok</Badge>
                        : <Badge variant="outline" className="border-destructive text-destructive">App difere {fmt(o.appDiff)}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            Informe o saldo do extrato no último dia do mês. "Diferença" = saldo final calculado − extrato. O valor digitado fica salvo só neste navegador.
          </p>
        </CardContent>
      </Card>

      {/* Detalhe da conta */}
      {selected && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              {selected.account.name} · {monthLabel(month)}
              <span className="text-xs text-muted-foreground font-normal">(data-base {formatIsoDateBR(selected.account.opening_balance_date)}, abertura {fmt(selected.account.opening_balance)})</span>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={selected.r.lines.length === 0}>
              <Download className="h-4 w-4 mr-1" />Exportar CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.r.beforeOpening && (
              <p className="text-sm text-muted-foreground">Este mês é anterior ou igual à data-base da conta: o saldo começa a ser apurado depois de {formatIsoDateBR(selected.account.opening_balance_date)}.</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["Saldo inicial", selected.r.startBalance, ""], ["Entradas", selected.r.inflow, "text-emerald-600"], ["Saídas", -selected.r.outflow, "text-destructive"], ["Saldo final", selected.r.endBalance, "font-bold"]].map(([l, v, c]) => (
                <div key={l as string} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className={`text-lg font-mono ${c}`}>{fmt(v as number)}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="text-left py-2">Data efetiva</th>
                    <th className="text-left py-2">Descrição</th>
                    <th className="text-left py-2">Categoria / centro de custo</th>
                    <th className="text-right py-2">Valor</th>
                    <th className="text-right py-2">Saldo após</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.r.lines.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum lançamento pago neste mês.</td></tr>
                  )}
                  {selected.r.lines.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="py-1.5 whitespace-nowrap">{formatIsoDateBR(l.effective_date)}</td>
                      <td className="py-1.5">{l.description}</td>
                      <td className="py-1.5 text-xs text-muted-foreground">{[l.category, l.center_cost].filter(Boolean).join(" · ")}</td>
                      <td className={`py-1.5 text-right font-mono ${l.signed >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(l.signed)}</td>
                      <td className="py-1.5 text-right font-mono">{fmt(l.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected.r.planned.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  {selected.r.planned.length} lançamento(s) previstos com vencimento neste mês ({fmt(selected.r.plannedTotal)}) — não entram no saldo até serem pagos
                </summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {selected.r.planned.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 border-b py-1">
                      <span>{formatIsoDateBR(p.due_date)} · {p.description}</span>
                      <span className="font-mono">{fmt(p.transaction_type === "income" ? p.amount : -p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
