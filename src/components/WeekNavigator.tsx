import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface WeekNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export const WeekNavigator = ({ currentDate, onDateChange }: WeekNavigatorProps) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const goToPreviousWeek = () => onDateChange(subWeeks(currentDate, 1));
  const goToNextWeek = () => onDateChange(addWeeks(currentDate, 1));

  const goToToday = () => {
    const now = new Date();
    const cancunDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
    const [year, month, day] = cancunDateStr.split('-').map(Number);
    onDateChange(new Date(year, month - 1, day, 12, 0, 0));
  };

  return (
    <div className="flex items-center justify-between gap-2 bg-card rounded-2xl p-3 shadow-sm border-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={goToPreviousWeek}
        className="h-9 w-9 rounded-xl"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 flex-1 justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="gap-2 rounded-xl font-medium text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                {format(weekStart, 'd MMM', { locale: es })} – {format(weekEnd, 'd MMM yyyy', { locale: es })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-2xl" align="center">
            <CalendarComponent
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && onDateChange(date)}
              initialFocus
              locale={es}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToToday}
          className="text-primary font-medium text-sm rounded-xl"
        >
          Hoy
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={goToNextWeek}
        className="h-9 w-9 rounded-xl"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
};
