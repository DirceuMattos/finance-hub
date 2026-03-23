import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const columns: Column<Record<string, unknown>>[] = [
  { key: "nome", header: "Nome" },
  { key: "bandeira", header: "Bandeira" },
  { key: "limite", header: "Limite" },
  { key: "fechamento", header: "Fechamento" },
  { key: "vencimento", header: "Vencimento" },
];

export default function Cartoes() {
  const [search, setSearch] = useState("");

  return (
    <AppLayout>
      <PageHeader
        title="Cartões"
        description="Gerencie seus cartões de crédito"
        actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar cartão..." />
      <DataTable columns={columns} data={[]} loading={false} />
    </AppLayout>
  );
}
