import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from "lucide-react";

export default function Dashboard() {
  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral das suas finanças" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Saldo Atual" value="R$ 0,00" icon={DollarSign} description="Atualizado agora" />
        <StatCard title="Receitas" value="R$ 0,00" icon={TrendingUp} description="Este mês" />
        <StatCard title="Despesas" value="R$ 0,00" icon={TrendingDown} description="Este mês" />
        <StatCard title="Cartões" value="R$ 0,00" icon={CreditCard} description="Faturas em aberto" />
      </div>
    </AppLayout>
  );
}
