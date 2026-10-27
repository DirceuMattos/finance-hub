import { AppLayout } from "@/components/layout/AppLayout";
import { AccountsTab } from "@/components/configuracoes/AccountsTab";

// Contas bancárias: saiu de Configurações e passou para a área Financeiro.
export default function Contas() {
  return (
    <AppLayout>
      <AccountsTab />
    </AppLayout>
  );
}
