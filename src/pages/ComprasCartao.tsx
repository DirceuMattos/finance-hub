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
  { key: "cartao", header: "Cartão" },
  { key: "parcelas", header: "Parcelas" },
  { key: "valor", header: "Valor" },
];

export default function ComprasCartao() {
  const [search, setSearch] = useState("");

  return (
    <AppLayout>
      <PageHeader
        title="Compras no Cartão"
        description="Registre e acompanhe compras parceladas"
        actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova</Button>}
      />
      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar compra..." />
      <DataTable columns={columns} data={[]} loading={false} />
    </AppLayout>
  );
}
