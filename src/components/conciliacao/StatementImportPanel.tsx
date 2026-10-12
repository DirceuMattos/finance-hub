import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle2, FileUp, History, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import {
  findAppliedImport, useApplyReconciliation, useReconciliationRules, useStatementImports,
  useUndoReconciliation, useUnassignedPlanned,
} from "@/hooks/useStatementReconciliation";
import { parseStatement, readStatementFile, statementHash, type ParsedStatement } from "@/lib/statementParsers";
import {
  approvedEffect, matchStatement, suggestDescription, suggestPattern, type AppTx, type MatchResult,
} from "@/lib/statementMatching";
import { balanceAt, type ReconAccount, type ReconTransaction } from "@/lib/reconciliation";
import { formatIsoDateBR } from "@/lib/cardCycle";
import { evaluateExpression } from "@/lib/calc";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const round2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (iso: string, d: number) => new Date(Date.parse(iso + "T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);

interface Props {
  accounts: ReconAccount[];
  byAccount: Map<string, ReconTransaction[]>;
}

interface BankChoice {
  approve: boolean;
  kind: "create" | "settle" | "update_amount" | "ignore";
  description: string;
  categoryId: string;
  saveRule: boolean;
}

export function StatementImportPanel({ accounts, byAccount }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.app_metadata?.is_admin === true;
  const { data: categories = [] } = useCategories();
  const rulesQ = useReconciliationRules();
  const apply = useApplyReconciliation();
  const undo = useUndoReconciliation();

  const [accountId, setAccountId] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [hash, setHash] = useState("");
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [ledgerText, setLedgerText] = useState("");
  const [ledgerDate, setLedgerDate] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [bankChoice, setBankChoice] = useState<Record<string, BankChoice>>({});
  const [cancelIds, setCancelIds] = useState<Set<string>>(new Set());
  const [useAdjust, setUseAdjust] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);

  // Referência banco:conta já associada às contas (coluna nova; se o banco ainda não tiver, segue sem ela)
  const refsQ = useQuery({
    queryKey: ["accounts_statement_ref"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("accounts").select("id, statement_ref");
      if (error) return new Map<string, string>();
      const m = new Map<string, string>();
      (data || []).forEach((a: any) => a.statement_ref && m.set(a.statement_ref, a.id));
      return m;
    },
  });
  const importsQ = useStatementImports(accountId || null);
  const featureMissing = !!rulesQ.error || !!importsQ.error;

  const winFrom = parsed?.periodStart ? addDays(parsed.periodStart, -15) : null;
  const winTo = parsed?.periodEnd ? addDays(parsed.periodEnd, 15) : null;
  const unassignedQ = useUnassignedPlanned(winFrom, winTo);

  const account = accounts.find((a) => a.id === accountId) || null;
  const txs = (account && byAccount.get(account.id)) || [];
  const catName = (id: string | null | undefined) => categories.find((c) => c.id === id)?.name || "";
  const ledger = ledgerText.trim() ? evaluateExpression(ledgerText) : null;

  const reset = () => { setResult(null); setBankChoice({}); setCancelIds(new Set()); setUseAdjust(false); };

  const onFile = async (file: File | undefined) => {
    reset();
    setParsed(null); setDuplicate(false);
    if (!file) return;
    try {
      const text = await readStatementFile(file);
      const p = parseStatement(file.name, text);
      const h = await statementHash(text);
      setFileName(file.name); setHash(h); setParsed(p);
      setLedgerText(p.ledgerBalance !== null ? String(p.ledgerBalance).replace(".", ",") : "");
      setLedgerDate(p.ledgerDate || p.periodEnd || "");
      const known = p.bankRef ? refsQ.data?.get(p.bankRef) : undefined;
      if (known) setAccountId(known);
      if (p.lines.length === 0) toast.warning("Nenhuma linha encontrada no arquivo.");
      p.warnings.forEach((w) => toast.warning(w));
    } catch (e: any) {
      toast.error("Não foi possível ler o arquivo: " + (e?.message || "erro"));
    }
  };

  const compare = async () => {
    if (!parsed || !account) return;
    try {
      const dup = await findAppliedImport(account.id, hash);
      setDuplicate(!!dup);
    } catch { /* tabela ausente: tratado em featureMissing */ }
    const paid = txs.filter((t) => t.status === "paid") as AppTx[];
    const planned = [
      ...(txs.filter((t) => t.status === "planned") as AppTx[]),
      ...((unassignedQ.data || []) as AppTx[]),
    ];
    const rules = (rulesQ.data || []).filter((r) => !r.account_id || r.account_id === account.id);
    const r = matchStatement(parsed.lines, paid, planned, rules);
    const choices: Record<string, BankChoice> = {};
    r.bank.forEach((b) => {
      if (b.status === "matched" || b.status === "group" || b.status === "internal" || b.status === "invoice") return;
      choices[b.key] = {
        approve: true,
        kind: (b.suggestion as BankChoice["kind"]) || "create",
        description: b.rule?.description || suggestDescription(b.line.memo),
        categoryId: b.rule?.category_id || "",
        saveRule: false,
      };
    });
    setResult(r); setBankChoice(choices); setCancelIds(new Set()); setUseAdjust(false);
  };

  // Saldos: app na data do extrato, efeito do que está aprovado e o que sobra
  const summary = useMemo(() => {
    if (!result || !account) return null;
    const date = ledgerDate || parsed?.periodEnd || "";
    const appAt = date ? balanceAt(account, txs, date) : account.current_balance;
    const items = result.bank.flatMap((b) => {
      const c = bankChoice[b.key];
      if (!c || !c.approve || c.kind === "ignore") return [];
      return [{ kind: c.kind, bankAmount: b.line.amount, appAmount: b.appAmount }];
    });
    result.appOnly.forEach((a) => { if (cancelIds.has(a.tx.id)) items.push({ kind: "cancel" as const, bankAmount: 0, appSigned: a.signed } as any); });
    const effect = approvedEffect(items as any);
    const expected = round2(appAt + effect);
    const residual = ledger !== null ? round2(ledger - expected) : null;
    return { date, appAt, effect, expected, residual, count: items.length };
  }, [result, bankChoice, cancelIds, account, txs, ledger, ledgerDate, parsed]);

  const plannedLabel = (id?: string) => {
    if (!id) return "";
    const p = [...txs, ...((unassignedQ.data || []) as any[])].find((t: any) => t.id === id);
    return p ? `${p.description} (${formatIsoDateBR(p.due_date)})` : "previsto";
  };

  const buildActions = () => {
    if (!result) return [];
    const actions: Record<string, unknown>[] = [];
    for (const b of result.bank) {
      const c = bankChoice[b.key];
      if (!c || !c.approve || c.kind === "ignore") continue;
      if (c.kind === "create") {
        actions.push({ type: "create", date: b.line.date, amount: b.line.amount, description: c.description, category_id: c.categoryId || null });
        if (c.saveRule) {
          actions.push({ type: "rule", pattern: suggestPattern(b.line.memo), description: c.description, category_id: c.categoryId || null,
                         transaction_type: b.line.amount > 0 ? "income" : "expense" });
        }
      } else if (c.kind === "settle" && b.plannedId) {
        actions.push({ type: "settle", id: b.plannedId, date: b.line.date });
      } else if (c.kind === "update_amount" && b.appIds[0]) {
        actions.push({ type: "update_amount", id: b.appIds[0], amount: b.line.amount });
      }
    }
    cancelIds.forEach((id) => actions.push({ type: "cancel", id }));
    if (useAdjust && summary?.residual) {
      actions.push({ type: "adjust", date: summary.date, amount: summary.residual, description: `Ajuste de conciliação — extrato até ${formatIsoDateBR(summary.date)}` });
    }
    return actions;
  };

  const doApply = async () => {
    if (!parsed || !account || !result) return;
    const actions = buildActions();
    const lines = result.bank.map((b) => ({
      line_date: b.line.date, amount: b.line.amount, memo: b.line.memo, fitid: b.line.fitid,
      match_status: b.status, transaction_ids: b.appIds,
    }));
    const res = await apply.mutateAsync({
      import: {
        account_id: account.id, file_name: fileName, file_hash: hash, source: parsed.source,
        period_start: parsed.periodStart, period_end: parsed.periodEnd,
        ledger_balance: ledger, ledger_date: ledgerDate || null, statement_ref: parsed.bankRef,
      },
      lines, actions,
    });
    toast.success(`Conciliação aplicada. Saldo da conta: ${fmt(Number(res.balance_after) || 0)}.`);
    setConfirming(false);
    reset(); setParsed(null); setFileName(""); setHash("");
  };

  const setChoice = (key: string, patch: Partial<BankChoice>) => setBankChoice((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  const toggleCancel = (id: string) => setCancelIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!isAdmin) {
    return (
      <Card className="mb-6">
        <CardContent className="py-4 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" />A importação e a conciliação de extratos são feitas somente pelo administrador.
        </CardContent>
      </Card>
    );
  }

  const divergent = result ? result.bank.filter((b) => bankChoice[b.key]) : [];
  const matched = result ? result.bank.filter((b) => b.status === "matched" || b.status === "group") : [];
  const internal = result ? result.bank.filter((b) => b.status === "internal") : [];
  const invoices = result ? result.bank.filter((b) => b.status === "invoice") : [];
  const bankRefAccount = parsed?.bankRef ? refsQ.data?.get(parsed.bankRef) : undefined;
  const actionCount = result ? buildActions().length : 0;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileUp className="h-4 w-4 text-primary" />Importar extrato do banco (OFX ou CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {featureMissing && (
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />A conciliação de extratos depende de uma atualização do banco de dados que ainda não foi aplicada.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Conta</Label>
            <Select value={accountId} onValueChange={(v) => { setAccountId(v); reset(); }}>
              <SelectTrigger id="stmt-account" className="h-9 w-56 text-xs"><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="stmt-file" className="text-xs">Arquivo</Label>
            <Input id="stmt-file" type="file" accept=".ofx,.csv,.txt" className="h-9 w-72 text-xs" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="stmt-ledger" className="text-xs">Saldo do extrato</Label>
            <Input id="stmt-ledger" value={ledgerText} onChange={(e) => setLedgerText(e.target.value)} placeholder="ex.: -3.993,92" className="h-9 w-32 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="stmt-ledger-date" className="text-xs">em</Label>
            <Input id="stmt-ledger-date" type="date" value={ledgerDate} onChange={(e) => setLedgerDate(e.target.value)} className="h-9 w-36 text-xs" />
          </div>
          <Button size="sm" className="h-9" onClick={compare} disabled={!parsed || !account || featureMissing || parsed.lines.length === 0}>Comparar</Button>
        </div>

        {parsed && (
          <p className="text-xs text-muted-foreground">
            {fileName}: {parsed.lines.length} linha(s) de {formatIsoDateBR(parsed.periodStart)} a {formatIsoDateBR(parsed.periodEnd)}.
            {" "}O arquivo é lido só neste navegador e não é guardado.
            {parsed.bankRef && bankRefAccount && bankRefAccount !== accountId && (
              <span className="text-amber-700 dark:text-amber-400"> Este arquivo já foi associado a outra conta ({accounts.find((a) => a.id === bankRefAccount)?.name}).</span>
            )}
            {parsed.source === "csv" && !ledgerText && <span> Informe o saldo do extrato para ver a diferença final.</span>}
          </p>
        )}
        {duplicate && (
          <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Este arquivo já foi conciliado nesta conta. Desfaça a conciliação anterior para importar de novo.</p>
        )}

        {result && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Conciliados</p><p className="font-semibold text-emerald-600">{matched.length + invoices.length}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Divergências</p><p className="font-semibold text-amber-600">{divergent.length + result.appOnly.length}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Saldo no app em {formatIsoDateBR(summary.date)}</p><p className="font-mono">{fmt(summary.appAt)}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Depois das ações marcadas</p><p className="font-mono">{fmt(summary.expected)}</p></div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Extrato</p>
                <p className="font-mono">{ledger !== null ? fmt(ledger) : "—"}</p>
                {summary.residual !== null && (
                  <p className={`text-xs ${summary.residual === 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {summary.residual === 0 ? "Confere" : `Sobra ${fmt(summary.residual)}`}
                  </p>
                )}
              </div>
            </div>

            {divergent.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-xs font-medium mb-1">No extrato e não no app ({divergent.length})</p>
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="border-b text-muted-foreground">
                    <tr><th className="w-8" /><th className="text-left py-1">Data</th><th className="text-left">Histórico do banco</th><th className="text-right">Valor</th><th className="text-left pl-3">Ação</th><th className="text-left">Descrição</th><th className="text-left">Categoria</th><th className="text-left">Regra</th></tr>
                  </thead>
                  <tbody>
                    {divergent.map((b) => {
                      const c = bankChoice[b.key];
                      const nature = b.line.amount > 0 ? "income" : "expense";
                      return (
                        <tr key={b.key} className="border-b align-top">
                          <td className="py-1"><Checkbox checked={c.approve} onCheckedChange={(v) => setChoice(b.key, { approve: !!v })} aria-label="Aprovar" /></td>
                          <td className="py-1 whitespace-nowrap">{formatIsoDateBR(b.line.date)}</td>
                          <td className="py-1 max-w-[260px] truncate" title={b.line.memo}>{b.line.memo}</td>
                          <td className={`py-1 text-right font-mono ${b.line.amount < 0 ? "text-destructive" : "text-emerald-600"}`}>{fmt(b.line.amount)}</td>
                          <td className="py-1 pl-3">
                            <Select value={c.kind} onValueChange={(v) => setChoice(b.key, { kind: v as BankChoice["kind"] })}>
                              <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {b.status === "near" && <SelectItem value="update_amount">Corrigir valor ({fmt(b.appAmount || 0)} → {fmt(b.line.amount)})</SelectItem>}
                                {b.plannedId && <SelectItem value="settle">Baixar previsto: {plannedLabel(b.plannedId)}</SelectItem>}
                                <SelectItem value="create">Lançar no app</SelectItem>
                                <SelectItem value="ignore">Ignorar</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1">
                            {c.kind === "create" ? <Input value={c.description} onChange={(e) => setChoice(b.key, { description: e.target.value })} className="h-7 w-52 text-xs" /> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-1">
                            {c.kind === "create" ? (
                              <Select value={c.categoryId || "none"} onValueChange={(v) => setChoice(b.key, { categoryId: v === "none" ? "" : v })}>
                                <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem categoria</SelectItem>
                                  {categories.filter((x) => x.is_active && (x.transaction_nature === nature || x.transaction_nature === "mixed"))
                                    .map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-1">
                            {c.kind === "create" && (
                              <label className="flex items-center gap-1 whitespace-nowrap" title={`Próximas vezes, "${suggestPattern(b.line.memo)}" vira esta descrição e categoria`}>
                                <Checkbox checked={c.saveRule} onCheckedChange={(v) => setChoice(b.key, { saveRule: !!v })} />Lembrar
                              </label>
                            )}
                            {b.rule && <Badge variant="outline" className="text-[10px] mt-1">regra: {b.rule.pattern}</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {invoices.length > 0 && (
              <div className="rounded-md border p-2 text-xs space-y-1">
                <p className="font-medium">Pagamentos de fatura de cartão ({invoices.length}) — os itens do cartão já estão no app; nada é lançado aqui</p>
                {invoices.map((b) => {
                  const diff = round2(b.line.amount - (b.appAmount || 0));
                  return (
                    <div key={b.key} className="flex flex-wrap justify-between gap-2 border-b py-1">
                      <span>{formatIsoDateBR(b.line.date)} · {b.line.memo}</span>
                      <span className="font-mono">
                        extrato {fmt(b.line.amount)} · itens no app {fmt(b.appAmount || 0)} ({b.appIds.length})
                        {" "}<span className={diff === 0 ? "text-emerald-600" : "text-destructive"}>{diff === 0 ? "confere" : `diferença ${fmt(diff)}`}</span>
                      </span>
                    </div>
                  );
                })}
                <p className="text-muted-foreground">Se houver diferença, confira a fatura na tela Cartões (itens faltando, encargos, IOF).</p>
              </div>
            )}

            {result.appOnly.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-xs font-medium mb-1">No app e não no extrato ({result.appOnly.length}) — marque só o que for duplicado ou não existiu</p>
                <table className="w-full text-xs min-w-[700px]">
                  <thead className="border-b text-muted-foreground">
                    <tr><th className="w-8" /><th className="text-left py-1">Data</th><th className="text-left">Descrição</th><th className="text-left">Categoria / cartão</th><th className="text-right">Valor</th><th className="text-left pl-3">Ação se marcado</th></tr>
                  </thead>
                  <tbody>
                    {result.appOnly.map((a) => (
                      <tr key={a.tx.id} className="border-b">
                        <td className="py-1"><Checkbox checked={cancelIds.has(a.tx.id)} onCheckedChange={() => toggleCancel(a.tx.id)} aria-label="Cancelar" /></td>
                        <td className="py-1 whitespace-nowrap">{formatIsoDateBR(a.date)}</td>
                        <td className="py-1">{a.tx.description}</td>
                        <td className="py-1 text-muted-foreground">{[(a.tx as any).category, a.tx.center_cost].filter(Boolean).join(" · ")}</td>
                        <td className={`py-1 text-right font-mono ${a.signed < 0 ? "text-destructive" : "text-emerald-600"}`}>{fmt(a.signed)}</td>
                        <td className="py-1 pl-3 text-muted-foreground">Cancelar (fica no histórico)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {summary.residual !== null && summary.residual !== 0 && (
              <label className="flex items-center gap-2 text-sm rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                <Checkbox checked={useAdjust} onCheckedChange={(v) => setUseAdjust(!!v)} />
                Lançar "Ajuste de conciliação" de {fmt(summary.residual)} em {formatIsoDateBR(summary.date)} para o saldo ficar igual ao extrato
                <span className="text-xs text-muted-foreground">(use só depois de tratar as divergências acima)</span>
              </label>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Conciliados ({matched.length}) e movimentos internos ignorados ({internal.length})</summary>
              <ul className="mt-2 space-y-0.5">
                {[...matched, ...internal].map((b) => (
                  <li key={b.key} className="flex justify-between gap-3 border-b py-0.5">
                    <span>{formatIsoDateBR(b.line.date)} · {b.line.memo}</span>
                    <span className="font-mono">{fmt(b.line.amount)} {b.status === "group" ? `(${b.appIds.length} lanç.)` : b.status === "internal" ? "(interno)" : ""}</span>
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => setConfirming(true)} disabled={actionCount === 0 || duplicate || apply.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Aplicar {actionCount} ação(ões)
              </Button>
              <span className="text-xs text-muted-foreground">Nada muda até você confirmar. Tudo pode ser desfeito no histórico abaixo.</span>
            </div>
          </div>
        )}

        {account && (importsQ.data?.length ?? 0) > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-1 flex items-center gap-1"><History className="h-3.5 w-3.5" />Conciliações de {account.name}</p>
            <table className="w-full text-xs">
              <tbody>
                {importsQ.data!.map((i) => (
                  <tr key={i.id} className="border-b">
                    <td className="py-1 whitespace-nowrap">{formatIsoDateBR(i.created_at)}</td>
                    <td className="py-1">{i.file_name}</td>
                    <td className="py-1 whitespace-nowrap">{formatIsoDateBR(i.period_start)} a {formatIsoDateBR(i.period_end)}</td>
                    <td className="py-1 text-right font-mono">{i.balance_before !== null ? fmt(Number(i.balance_before)) : "—"} → {i.balance_after !== null ? fmt(Number(i.balance_after)) : "—"}</td>
                    <td className="py-1 pl-3">
                      {i.status === "aplicada"
                        ? <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setUndoId(i.id)} disabled={undo.isPending}><RotateCcw className="h-3 w-3 mr-1" />Desfazer</Button>
                        : <Badge variant="outline" className="text-[10px]">desfeita</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar a conciliação?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p>{actionCount} ação(ões) em {account?.name}. O saldo no app em {formatIsoDateBR(summary?.date)} passa de {fmt(summary?.appAt || 0)} para {fmt((summary?.expected || 0) + (useAdjust ? summary?.residual || 0 : 0))}.</p>
                <p>As linhas do extrato ficam registradas para auditoria; o arquivo não é guardado.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apply.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doApply(); }} disabled={apply.isPending}>
              {apply.isPending ? "Aplicando..." : "Aplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!undoId} onOpenChange={(o) => !o && setUndoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer esta conciliação?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos criados são excluídos, os alterados voltam ao que eram e as linhas do extrato são apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (undoId) await undo.mutateAsync(undoId); setUndoId(null); }}>Desfazer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
