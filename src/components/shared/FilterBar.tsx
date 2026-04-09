import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  onClear?: () => void;
  hasActiveFilters?: boolean;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  children,
  onClear,
  hasActiveFilters = false,
}: FilterBarProps) {
  const showClear = searchValue.length > 0 || hasActiveFilters;

  const handleClear = () => {
    onSearchChange("");
    onClear?.();
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
      <div className="relative flex-1 w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      {showClear && (
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
