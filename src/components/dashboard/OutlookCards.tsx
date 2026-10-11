import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIsoDateBR } from "@/lib/cardCycle";
import type { CardLimitRow, MonthOutlook } from "@/lib/dashboardOutlook";

const fmtCur = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const levelBar: Record<CardLimitRow["level"], string> = {
  ok: "bg-emerald-500",
  attention: "bg-amber-500",
  over: "bg-red-500",
  none: "bg-muted-foreground/40",
};

const entityLabel = (t: string | null) => (t === "business" ? "Empresa" : t === "personal" ? "Pessoal" : "—");

interface Props {
  outlook: MonthOutlook | null;
  outlookLoading: boolean;
  limits: CardLimitRow[];
  limitsLoading: boolean;
  monthLabel: string;
}

export function OutlookCards({ outlook, outlookLoading, limits, limitsLoading, monthLabel }: Props) {
  const missingBankLimit = limits.some((l) => l.creditLimit <= 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Saldo previsto no fim do mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Saldo previsto nas contas no fim de {monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {outlookLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !outlook ? (
            <p className="text-sm text-muted-foreground">Mês encerrado: a previsão vale para o mês atual e os seguintes.</p>
          ) : (
            <>
              <p className={cn("text-3xl font-bold", outlook.projected >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {fmtCur(outlook.projected)}
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-muted-foreground">Saldo atual</p><p className={cn("font-semibold", outlook.current < 0 && "text-red-600 dark:text-red-400")}>{fmtCur(outlook.current)}</p></div>
                <div><p className="text-muted-foreground">+ Receitas previstas</p><p className="font-semibold text-emerald-600 dark:text-emerald-400">{fmtCur(outlook.incomePlanned)}</p></div>
                <div><p className="text-muted-foreground">− Despesas previstas</p><p className="font-semibold text-red-600 dark:text-red-400">{fmtCur(outlook.expensePlanned)}</p></div>
              </div>
              {outlook.overdueCount > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Inclui {outlook.overdueCount} previsto(s) atrasado(s), saldo {fmtCur(outlook.overdueNet)}.
                </p>
              )}
              <div className="border-t pt-2">
                <p className="text-xs font-medium mb-1">Contas negativas hoje</p>
                {outlook.negatives.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma.</p>
                ) : (
                  <ul className="text-xs space-y-0.5">
                    {outlook.negatives.map((n) => (
                      <li key={n.name} className="flex justify-between gap-3">
                        <span>{n.name}</span>
                        <span className="font-mono text-red-600 dark:text-red-400">{fmtCur(n.balance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Limites dos cartões */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Limites dos cartões — fatura de {monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {limitsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : limits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cartão com teto, limite ou uso nesta visão.</p>
          ) : (
            <>
              {limits.map((l) => {
                const width = l.pct === null ? 0 : Math.min(l.pct, 1) * 100;
                return (
                  <div key={l.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">{l.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{entityLabel(l.entity_type)}</Badge>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", levelBar[l.level])} style={{ width: `${width}%` }} />
                    </div>
                    <p className="text-xs">
                      Fatura {fmtCur(l.invoice)}
                      {l.ceiling > 0 ? (
                        <>
                          {" "}de teto {fmtCur(l.ceiling)} ·{" "}
                          {l.margin !== null && l.margin >= 0 ? (
                            <span className={cn("font-semibold", l.level === "attention" ? "text-amber-700 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                              ainda cabe {fmtCur(l.margin)}
                            </span>
                          ) : (
                            <span className="font-semibold text-red-600 dark:text-red-400">acima do teto em {fmtCur(Math.abs(l.margin ?? 0))}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground"> · sem teto gerencial</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Período {formatIsoDateBR(l.cycleStart)} a {formatIsoDateBR(l.cycleEnd)} ·{" "}
                      {l.available !== null ? (
                        <>Limite do banco: disponível <span className={cn("font-semibold", l.available < 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>{fmtCur(l.available)}</span> (em aberto {fmtCur(l.openTotal)} de {fmtCur(l.creditLimit)})</>
                      ) : (
                        <>Em aberto em todas as faturas: {fmtCur(l.openTotal)}</>
                      )}
                    </p>
                  </div>
                );
              })}
              {missingBankLimit && (
                <p className="text-[11px] text-muted-foreground border-t pt-2">
                  Para ver o limite disponível no banco, cadastre o limite de cada cartão em Configurações → Cartões.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
