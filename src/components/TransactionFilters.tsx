import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, FilterX, Calendar } from "lucide-react";

interface TransactionFiltersProps {
  userId: string;
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  weekId: string | null;
  categoria: string | null;
  metodoPago: string | null;
  searchTerm: string;
}


export const TransactionFilters = ({
  userId,
  onFilterChange,
}: TransactionFiltersProps) => {
  const [weeks, setWeeks] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    weekId: null,
    categoria: null,
    metodoPago: null,
    searchTerm: "",
  });

  useEffect(() => {
    loadWeeks();
    loadCategories();
  }, [userId]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("sobres")
      .select("nombre")
      .eq("user_id", userId)
      .order("nombre");
    if (data) setCategories(data.map(s => s.nombre));
  };

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const loadWeeks = async () => {
    const { data } = await supabase
      .from("semanas")
      .select("*")
      .eq("user_id", userId)
      .order("fecha_inicio", { ascending: false })
      .limit(10);

    if (data) setWeeks(data);
  };

  const handleReset = () => {
    const resetFilters = {
      weekId: null,
      categoria: null,
      metodoPago: null,
      searchTerm: "",
    };
    setFilters(resetFilters);
  };

  const hasActiveFilters =
    filters.weekId ||
    filters.categoria ||
    filters.metodoPago ||
    filters.searchTerm;

  return (
    <Card className="p-4 mb-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar y Filtrar
          </h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8"
            >
              <FilterX className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search term */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <Input
              placeholder="Descripción..."
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters({ ...filters, searchTerm: e.target.value })
              }
              className="h-9"
            />
          </div>

          {/* Week filter */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Semana
            </label>
            <Select
              value={filters.weekId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  weekId: value === "all" ? null : value,
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las semanas</SelectItem>
                {weeks.map((week) => (
                  <SelectItem key={week.id} value={week.id}>
                    {format(new Date(week.fecha_inicio), "dd MMM", {
                      locale: es,
                    })}{" "}
                    -{" "}
                    {format(new Date(week.fecha_fin), "dd MMM yyyy", {
                      locale: es,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Categoría</label>
            <Select
              value={filters.categoria || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  categoria: value === "all" ? null : value,
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment method filter */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Método de pago
            </label>
            <Select
              value={filters.metodoPago || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  metodoPago: value === "all" ? null : value,
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  );
};
