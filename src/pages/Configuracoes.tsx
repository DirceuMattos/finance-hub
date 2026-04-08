import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Wallet, CreditCard, Tag, Settings, Users, BarChart3 } from "lucide-react";
import { FinancialEntitiesTab } from "@/components/configuracoes/FinancialEntitiesTab";
import { AccountsTab } from "@/components/configuracoes/AccountsTab";
import { CardsTab } from "@/components/configuracoes/CardsTab";
import { CategoriesTab } from "@/components/configuracoes/CategoriesTab";
import { InvestmentClassesTab } from "@/components/configuracoes/InvestmentClassesTab";
import { SystemParametersTab } from "@/components/configuracoes/SystemParametersTab";
import { UsersTab } from "@/components/configuracoes/UsersTab";

export default function Configuracoes() {
  return (
    <AppLayout>
      <Tabs defaultValue="entities" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="entities" className="gap-1.5"><Building2 className="h-4 w-4" />Entidades</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5"><Wallet className="h-4 w-4" />Contas</TabsTrigger>
          <TabsTrigger value="cards" className="gap-1.5"><CreditCard className="h-4 w-4" />Cartões</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tag className="h-4 w-4" />Categorias</TabsTrigger>
          <TabsTrigger value="inv-classes" className="gap-1.5"><BarChart3 className="h-4 w-4" />Classes Invest.</TabsTrigger>
          <TabsTrigger value="parameters" className="gap-1.5"><Settings className="h-4 w-4" />Parâmetros</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="entities"><FinancialEntitiesTab /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="cards"><CardsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="parameters"><SystemParametersTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
