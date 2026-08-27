import { ScheduleSlotItem } from "@/components/schedule-slot-item";
import { groupSlotsByWeekday, WEEKDAY_LABELS, WEEKDAYS } from "@/lib/schedule";
import type { WeeklyScheduleSlot } from "@/types/domain";

export function ScheduleWeekBoard({
  slots,
  todayWeekday,
  canEdit,
}: {
  slots: WeeklyScheduleSlot[];
  todayWeekday: number;
  canEdit: boolean;
}) {
  const grouped = groupSlotsByWeekday(slots);

  return (
    <div className="week-board">
      {WEEKDAYS.map((day) => {
        const daySlots = grouped.get(day) ?? [];
        const isToday = day === todayWeekday;
        return (
          <section
            key={day}
            className={`week-day${isToday ? " is-today" : ""}`}
            aria-labelledby={`weekday-${day}`}
          >
            <header>
              <h3 id={`weekday-${day}`}>{WEEKDAY_LABELS[day].full}</h3>
              {isToday ? <span className="badge primary">Hoje</span> : null}
            </header>
            {daySlots.length === 0 ? (
              <p className="muted week-day-empty">Nenhum horário.</p>
            ) : (
              <ol>
                {daySlots.map((slot) => (
                  <ScheduleSlotItem key={slot.id} slot={slot} canEdit={canEdit} />
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
