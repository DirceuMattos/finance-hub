import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const columns: Column<Record<string, unknown>>[] = [
  { key: "descricao", header: "Descrição" },
  { key: "valor", header: "Valor" },
  { key: "frequencia", header: "Frequência" },
  { key: "proximo_vencimento", header: "Próx. Vencimento" },
  { key: "status", header: "Status" },
];

export default function Recorrencias() {
  const [search, setSearch] = useState("");

  return (
    <AppLayout>
      <PageHeader
        title="Recorrências"
        description="Lançamentos automáticos recorrentes"
        actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova</Button>}
      />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar recorrência..." />
      <DataTable columns={columns} data={[]} loading={false} />
    </AppLayout>
  );
}
