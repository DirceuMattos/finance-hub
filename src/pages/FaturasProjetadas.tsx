import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";

const columns: Column<Record<string, unknown>>[] = [
  { key: "mes_referencia", header: "Mês Referência" },
  { key: "cartao", header: "Cartão" },
  { key: "valor_total", header: "Valor Total" },
  { key: "vencimento", header: "Vencimento" },
  { key: "status", header: "Status" },
];

export default function FaturasProjetadas() {
  const [search, setSearch] = useState("");

  return (
    <AppLayout>
      <PageHeader
        title="Faturas Projetadas"
        description="Previsão de faturas dos cartões"
      />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar fatura..." />
      <DataTable columns={columns} data={[]} loading={false} />
    </AppLayout>
  );
}
