import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const goToPreviousWeek = () => {
    onDateChange(subWeeks(currentDate, 1));
  };

  const goToNextWeek = () => {
    onDateChange(addWeeks(currentDate, 1));
  };

  const goToToday = () => {
    // Get current date in Mexico timezone
    const now = new Date();
    const mexicoDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    const [year, month, day] = mexicoDateStr.split('-').map(Number);
    onDateChange(new Date(year, month - 1, day, 12, 0, 0));
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousWeek}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 flex-1 justify-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {format(weekStart, 'd MMM', { locale: es })} - {format(weekEnd, 'd MMM yyyy', { locale: es })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarComponent
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => date && onDateChange(date)}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm" onClick={goToToday}>
              Hoy
            </Button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={goToNextWeek}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
