import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Wallet, CreditCard, Tag, Settings, ShieldCheck } from "lucide-react";
import { FinancialEntitiesTab } from "@/components/configuracoes/FinancialEntitiesTab";
import { AccountsTab } from "@/components/configuracoes/AccountsTab";
import { CardsTab } from "@/components/configuracoes/CardsTab";
import { CategoriesTab } from "@/components/configuracoes/CategoriesTab";
import { SystemParametersTab } from "@/components/configuracoes/SystemParametersTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SecurityTab() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Autenticação Multifator (MFA)
        </CardTitle>
        <CardDescription>
          Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => navigate("/mfa-setup")}>
          Configurar MFA
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Configuracoes() {
  return (
    <AppLayout>
      <Tabs defaultValue="entities" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="entities" className="gap-1.5"><Building2 className="h-4 w-4" />Entidades</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5"><Wallet className="h-4 w-4" />Contas</TabsTrigger>
          <TabsTrigger value="cards" className="gap-1.5"><CreditCard className="h-4 w-4" />Cartões</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tag className="h-4 w-4" />Categorias</TabsTrigger>
          <TabsTrigger value="parameters" className="gap-1.5"><Settings className="h-4 w-4" />Parâmetros</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><ShieldCheck className="h-4 w-4" />Segurança</TabsTrigger>
        </TabsList>
        <TabsContent value="entities"><FinancialEntitiesTab /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="cards"><CardsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="parameters"><SystemParametersTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
