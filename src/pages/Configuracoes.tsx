import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Configuracoes() {
  return (
    <AppLayout>
      <PageHeader title="Configurações" description="Personalize o sistema" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Gerencie as categorias de receitas e despesas.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contas Bancárias</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Configure suas contas bancárias e saldos iniciais.
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
