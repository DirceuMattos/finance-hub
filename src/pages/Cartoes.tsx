import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { useCards } from "@/hooks/useCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard } from "lucide-react";

export default function Cartoes() {
  const { data: cards = [], isLoading } = useCards();
  const [search, setSearch] = useState("");

  const filtered = cards.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <AppLayout>
      <PageHeader title="Cartões" description="Visão geral dos seus cartões de crédito" />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar cartão..." />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-32 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum cartão encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((card) => {
            const limitUsage = card.credit_limit > 0 ? 0 : 0; // Real usage would come from a view
            const managerialLimit = card.managerial_limit || card.credit_limit;
            const managerialPct = managerialLimit > 0 ? 0 : 0;

            return (
              <Card key={card.id} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{card.name}</CardTitle>
                    </div>
                    {card.is_active
                      ? <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Ativo</Badge>
                      : <Badge variant="secondary">Inativo</Badge>
                    }
                  </div>
                  {card.issuer_bank && <p className="text-xs text-muted-foreground mt-1">{card.issuer_bank}</p>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Limite</p>
                      <p className="font-semibold">{fmt(card.credit_limit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Teto Gerencial</p>
                      <p className="font-semibold">{fmt(managerialLimit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fecha Dia</p>
                      <p className="font-semibold">{card.closing_day}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Vence Dia</p>
                      <p className="font-semibold">{card.due_day}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Uso do Limite</span>
                      <span className="font-medium">{fmt(0)} / {fmt(card.credit_limit)}</span>
                    </div>
                    <Progress value={limitUsage} className="h-2" />
                  </div>
                  {card.managerial_limit && card.managerial_limit < card.credit_limit && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Uso do Teto Gerencial</span>
                        <span className="font-medium">{fmt(0)} / {fmt(card.managerial_limit)}</span>
                      </div>
                      <Progress value={managerialPct} className="h-2" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Entidade: {card.financial_entities?.name || "—"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
