import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { useAlerts, type ViewType } from "@/hooks/useAlerts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const severityConfig: Record<string, { color: string; icon: typeof Info; label: string }> = {
  low: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: Info, label: "Baixo" },
  medium: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: AlertTriangle, label: "Médio" },
  high: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: ShieldAlert, label: "Alto" },
};

function getSeverity(severity: string) {
  return severityConfig[severity?.toLowerCase()] ?? severityConfig.low;
}

function AlertCards({ viewType }: { viewType: ViewType }) {
  const { data: alerts, isLoading, error } = useAlerts(viewType);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mb-3" />
        <p className="text-sm">Erro ao carregar alertas.</p>
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Bell className="h-10 w-10 mb-3" />
        <p className="text-sm">Nenhum alerta disponível no momento</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {alerts.map((alert, idx) => {
        const sev = getSeverity(alert.severity);
        const SevIcon = sev.icon;
        return (
          <Card key={`${alert.reference_month}_${alert.alert_type}_${alert.financial_entity_id}_${idx}`} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${sev.color.split(" ")[0]}`} />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold leading-tight">
                  {alert.title}
                </CardTitle>
                <Badge className={`shrink-0 ${sev.color}`}>
                  <SevIcon className="h-3 w-3 mr-1" />
                  {sev.label}
                </Badge>
              </div>
              {alert.reference_month && (
                <CardDescription className="text-xs mt-1">
                  {format(parseISO(alert.reference_month), "MMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{alert.message}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Alertas() {
  const [viewType, setViewType] = useState<ViewType>("consolidated");

  return (
    <AppLayout>
      <PageHeader title="Alertas" description="Alertas financeiros baseados nos dados do sistema" />

      <Tabs value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
        <TabsList>
          <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
          <TabsTrigger value="personal">Pessoal</TabsTrigger>
          <TabsTrigger value="business">Empresa</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidated">
          <AlertCards viewType="consolidated" />
        </TabsContent>
        <TabsContent value="personal">
          <AlertCards viewType="personal" />
        </TabsContent>
        <TabsContent value="business">
          <AlertCards viewType="business" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
