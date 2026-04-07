import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload, AlertTriangle, CheckCircle, Copy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRow {
  lineNumber: number;
  rawLine: string;
  competence_date: string | null;
  transaction_type: string;
  description: string;
  payee: string;
  amount: number | null;
  due_date: string | null;
  notes: string;
  account_id: string | null;
  account_name: string;
  category_id: string | null;
  category_name: string;
  financial_entity_id: string | null;
  entity_name: string;
  status: string;
  payment_date: string | null;
  errors: string[];
}

function parseBrDate(raw: string): string | null {
  if (!raw) return null;
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseBrNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^R\$\s*/i, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** RFC 4180 compliant CSV line parser — handles quoted fields with commas and escaped quotes */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ';') {
        fields.push(current.trim());
        current = "";
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function CsvImportDialog({ open, onOpenChange, onSuccess }: CsvImportDialogProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [debugHeaders, setDebugHeaders] = useState<string[]>([]);

  const reset = () => {
    setRows([]);
    setFileName("");
    setDebugHeaders([]);
  };

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error("CSV vazio ou sem dados."); setLoading(false); return; }

      const headers = parseCsvLine(lines[0]);
      setDebugHeaders(headers);

      // Fetch reference data
      const [accRes, catRes, entRes] = await Promise.all([
        (supabase as any).from("accounts").select("id, name"),
        (supabase as any).from("categories").select("id, name, transaction_nature"),
        (supabase as any).from("financial_entities").select("id, name"),
      ]);

      const accMap = new Map<string, string>();
      (accRes.data || []).forEach((a: any) => accMap.set(a.name.toLowerCase().trim(), a.id));
      const catMap = new Map<string, { id: string; nature: string | null }>();
      (catRes.data || []).forEach((c: any) => catMap.set(c.name.toLowerCase().trim(), { id: c.id, nature: c.transaction_nature || null }));
      const entMap = new Map<string, string>();
      (entRes.data || []).forEach((e: any) => entMap.set(e.name.toLowerCase().trim(), e.id));

      const expectedCols = [
        "competence_date", "transaction_type", "description", "payee",
        "valor", "vencimento", "observação", "conta", "categoria", "entidade financeira"
      ];

      const colIdx: Record<string, number> = {};
      const colNames = ["competence_date", "transaction_type", "Description", "payee", "Valor", "Vencimento", "Observação", "Conta", "Categoria", "Entidade Financeira"];
      const missingCols: string[] = [];
      colNames.forEach(cn => {
        const idx = headers.findIndex(h => h.toLowerCase().trim() === cn.toLowerCase());
        colIdx[cn] = idx;
        if (idx === -1 && expectedCols.includes(cn.toLowerCase())) {
          missingCols.push(cn);
        }
      });

      if (missingCols.length > 0) {
        toast.warning(`Colunas não encontradas no CSV: ${missingCols.join(", ")}. Verifique os cabeçalhos.`);
      }

      const today = new Date().toISOString().slice(0, 10);

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const errors: string[] = [];

        const rawCompetence = colIdx["competence_date"] >= 0 ? cols[colIdx["competence_date"]] || "" : "";
        const competence = parseBrDate(rawCompetence);
        if (!competence && rawCompetence) errors.push(`Data competência inválida: "${rawCompetence}"`);

        const rawTxType = colIdx["transaction_type"] >= 0 ? (cols[colIdx["transaction_type"]] || "").toLowerCase().trim() : "";

        // Derive transaction_type: category nature > CSV fallback mapping
        const categoryName = colIdx["Categoria"] >= 0 ? (cols[colIdx["Categoria"]] || "").trim() : "";
        const catEntry = categoryName ? catMap.get(categoryName.toLowerCase()) || null : null;
        const categoryId = catEntry ? catEntry.id : null;
        if (categoryName && !catEntry) errors.push(`Categoria não encontrada: "${categoryName}"`);

        const txTypeFallbackMap: Record<string, string> = {
          desp: "expense", despesa: "expense", despesas: "expense",
          rec: "income", receita: "income", receitas: "income", rend: "income",
          transf: "transfer", transferencia: "transfer", transferência: "transfer",
          income: "income", expense: "expense", transfer: "transfer",
        };
        let txType = "";
        if (catEntry?.nature) {
          txType = catEntry.nature;
        } else if (txTypeFallbackMap[rawTxType]) {
          txType = txTypeFallbackMap[rawTxType];
        } else if (rawTxType) {
          errors.push(`Tipo inválido: "${rawTxType}". Use: income, expense ou transfer`);
        } else {
          txType = "expense"; // default
        }

        const desc = colIdx["Description"] >= 0 ? cols[colIdx["Description"]] || "" : "";
        if (!desc) errors.push("Descrição vazia");

        const payee = colIdx["payee"] >= 0 ? cols[colIdx["payee"]] || "" : "";

        const rawAmount = colIdx["Valor"] >= 0 ? cols[colIdx["Valor"]] || "" : "";
        const amount = parseBrNumber(rawAmount);
        if (amount === null) errors.push(`Valor inválido: "${rawAmount || "(vazio)"}"`);

        const rawDueDate = colIdx["Vencimento"] >= 0 ? cols[colIdx["Vencimento"]] || "" : "";
        const dueDate = parseBrDate(rawDueDate);
        if (!dueDate && rawDueDate) errors.push(`Vencimento inválido: "${rawDueDate}"`);

        const notes = colIdx["Observação"] >= 0 ? cols[colIdx["Observação"]] || "" : "";

        const accountName = colIdx["Conta"] >= 0 ? (cols[colIdx["Conta"]] || "").trim() : "";
        const accountId = accountName ? accMap.get(accountName.toLowerCase()) || null : null;
        if (accountName && !accountId) errors.push(`Conta não encontrada: "${accountName}"`);

        // categoryName/categoryId already resolved above

        const entityName = colIdx["Entidade Financeira"] >= 0 ? (cols[colIdx["Entidade Financeira"]] || "").trim() : "";
        const entityId = entityName ? entMap.get(entityName.toLowerCase()) || null : null;
        if (entityName && !entityId) errors.push(`Entidade não encontrada: "${entityName}"`);

        const status = dueDate && dueDate <= today ? "paid" : "planned";
        const paymentDate = status === "paid" ? dueDate : null;

        parsed.push({
          lineNumber: i + 1,
          rawLine: lines[i],
          competence_date: competence,
          transaction_type: txType,
          description: desc,
          payee,
          amount,
          due_date: dueDate,
          notes,
          account_id: accountId,
          account_name: accountName,
          category_id: categoryId,
          category_name: categoryName,
          financial_entity_id: entityId,
          entity_name: entityName,
          status,
          payment_date: paymentDate,
          errors,
        });
      }

      setRows(parsed);
    } catch (err) {
      toast.error("Erro ao ler o arquivo CSV.");
    } finally {
      setLoading(false);
    }
  }, []);

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const payload = validRows.map(r => ({
        competence_date: r.competence_date,
        transaction_type: r.transaction_type,
        description: r.description,
        payee: r.payee || null,
        amount: r.amount,
        due_date: r.due_date,
        notes: r.notes || null,
        account_id: r.account_id,
        category_id: r.category_id,
        financial_entity_id: r.financial_entity_id,
        status: r.status,
        payment_date: r.payment_date,
      }));

      const batchSize = 100;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        const { error } = await (supabase as any).from("transactions").insert(batch);
        if (error) throw error;
      }

      toast.success(`${validRows.length} lançamento(s) importado(s) com sucesso!`);
      if (errorRows.length > 0) toast.warning(`${errorRows.length} linha(s) com erro foram ignoradas.`);
      onSuccess();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message || "Erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const fmt = (v: number | null) => v !== null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Lançamentos via CSV</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Selecione um arquivo CSV UTF-8 delimitado por ponto-e-vírgula (;)</p>
            <p className="text-xs text-muted-foreground">
              Colunas esperadas: competence_date, transaction_type, Description, payee, Valor, Vencimento, Observação, Conta, Categoria, Entidade Financeira
            </p>
            <Input type="file" accept=".csv" onChange={handleFile} disabled={loading} className="max-w-xs" />
            {loading && <p className="text-sm text-muted-foreground">Processando...</p>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="font-medium">{fileName}</span>
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3 text-[hsl(var(--success))]" />{validRows.length} válidos
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />{errorRows.length} com erro
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Colunas detectadas: {debugHeaders.join(" | ")}
              </span>
            </div>

            <TooltipProvider>
              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[60px]">Status</TableHead>
                      <TableHead className="text-xs">Competência</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Descrição</TableHead>
                      <TableHead className="text-xs">Favorecido</TableHead>
                      <TableHead className="text-xs">Valor</TableHead>
                      <TableHead className="text-xs">Vencimento</TableHead>
                      <TableHead className="text-xs">Conta</TableHead>
                      <TableHead className="text-xs">Categoria</TableHead>
                      <TableHead className="text-xs">Entidade</TableHead>
                      <TableHead className="text-xs min-w-[250px]">Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={r.errors.length > 0 ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-sm">
                                <ul className="list-disc pl-3 text-xs space-y-1">
                                  {r.errors.map((err, j) => <li key={j}>{err}</li>)}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{r.competence_date || "—"}</TableCell>
                        <TableCell className="text-xs">{r.transaction_type || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{r.description || "—"}</TableCell>
                        <TableCell className="text-xs">{r.payee || "—"}</TableCell>
                        <TableCell className="text-xs">{fmt(r.amount)}</TableCell>
                        <TableCell className="text-xs">{r.due_date || "—"}</TableCell>
                        <TableCell className="text-xs">{r.account_name || "—"}</TableCell>
                        <TableCell className="text-xs">{r.category_name || "—"}</TableCell>
                        <TableCell className="text-xs">{r.entity_name || "—"}</TableCell>
                        <TableCell className="text-xs text-destructive">
                          {r.errors.length > 0 ? (
                            <ul className="list-disc pl-3 space-y-0.5">
                              {r.errors.map((err, j) => <li key={j}>{err}</li>)}
                            </ul>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TooltipProvider>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { reset(); }}>Limpar</Button>
              <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
                {importing ? "Importando..." : `Importar ${validRows.length} lançamento(s)`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
