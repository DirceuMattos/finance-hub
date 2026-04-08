import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  className?: string;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  rowKey?: (row: T) => string;
}

export function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = "Nenhum registro encontrado.",
  defaultSortKey,
  defaultSortDir = "asc",
  className,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  rowKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortable) return data;
    const getValue = col.sortValue ?? ((row: T) => {
      const v = (row as any)[sortKey];
      return v ?? "";
    });
    return [...data].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir, columns]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const allKeys = useMemo(() => {
    if (!selectable || !rowKey) return new Set<string>();
    return new Set(sorted.map(row => rowKey(row)));
  }, [sorted, selectable, rowKey]);

  const allSelected = selectable && selectedKeys && allKeys.size > 0 && [...allKeys].every(k => selectedKeys.has(k));
  const someSelected = selectable && selectedKeys && allKeys.size > 0 && [...allKeys].some(k => selectedKeys.has(k)) && !allSelected;

  const handleSelectAll = () => {
    if (!onSelectionChange || !rowKey) return;
    if (allSelected) {
      // Deselect all visible
      const next = new Set(selectedKeys);
      allKeys.forEach(k => next.delete(k));
      onSelectionChange(next);
    } else {
      // Select all visible
      const next = new Set(selectedKeys);
      allKeys.forEach(k => next.add(k));
      onSelectionChange(next);
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && <TableHead className="w-10" />}
              {columns.map((col) => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {selectable && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-card ${className || ""}`}>
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10 px-2">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = someSelected;
                  }}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`text-xs font-medium uppercase text-muted-foreground ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center">
                  {col.header}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row, idx) => {
              const key = selectable && rowKey ? rowKey(row) : String(idx);
              const isSelected = selectable && selectedKeys?.has(key);
              return (
                <TableRow key={key} className={isSelected ? "bg-muted/50" : ""}>
                  {selectable && (
                    <TableCell className="px-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRow(key)}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key} className="text-xs py-1.5 px-2">
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
