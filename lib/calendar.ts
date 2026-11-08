export type OfficialSchedule = {
  id: string;
  title: string;
  regionName: string;
  eventDate: string | null;
  eventDates?: readonly string[];
  applicationStartsOn: string | null;
  applicationEndsOn: string | null;
  closingDate: string | null;
  sourceName: string;
  sourceUrl: string;
  checkedAt: string;
};

export function getKoreanDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getWeekDateKeys(dateKey: string): string[] {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const offsetFromMonday = (date.getUTCDay() + 6) % 7;
  const monday = addCalendarDays(dateKey, -offsetFromMonday);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index));
}

export function getMonthDateKeys(monthKey: string): string[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const offsetFromMonday = (firstDate.getUTCDay() + 6) % 7;
  const firstCell = addCalendarDays(firstDay, -offsetFromMonday);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(firstCell, index));
}

export function getScheduleLabelsForDate(
  schedule: OfficialSchedule,
  dateKey: string,
): string[] {
  const labels: string[] = [];
  if (schedule.eventDate === dateKey || schedule.eventDates?.includes(dateKey)) labels.push("행사일");
  return labels;
}
