import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const columns: Column<Record<string, unknown>>[] = [
  { key: "data", header: "Data" },
  { key: "descricao", header: "Descrição" },
  { key: "categoria", header: "Categoria" },
  { key: "valor", header: "Valor" },
  { key: "tipo", header: "Tipo" },
];

export default function Lancamentos() {
  const [search, setSearch] = useState("");

  return (
    <AppLayout>
      <PageHeader
        title="Lançamentos"
        description="Gerencie receitas e despesas"
        actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar lançamento..." />
      <DataTable columns={columns} data={[]} loading={false} />
    </AppLayout>
  );
}
