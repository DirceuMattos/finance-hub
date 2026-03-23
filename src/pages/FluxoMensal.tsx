import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function FluxoMensal() {
  return (
    <AppLayout>
      <PageHeader
        title="Fluxo Mensal"
        description="Projeção de receitas e despesas por mês"
      />
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <p>O fluxo mensal será exibido aqui com gráficos e projeções.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
