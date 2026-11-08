"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  addCalendarDays,
  getKoreanDateKey,
  getMonthDateKeys,
  getScheduleLabelsForDate,
  getWeekDateKeys,
  type OfficialSchedule,
} from "@/lib/calendar";

type CommunityCalendarProps = {
  schedules: readonly OfficialSchedule[];
};

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function formatKoreanDate(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ko-KR", {
    ...options,
    timeZone: "Asia/Seoul",
  }).format(new Date(`${dateKey}T00:00:00+09:00`));
}

function shiftMonth(monthKey: string, amount: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CommunityCalendar({ schedules }: CommunityCalendarProps) {
  const today = useMemo(() => getKoreanDateKey(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthView, setMonthView] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const dateKeys = monthView ? getMonthDateKeys(visibleMonth) : getWeekDateKeys(selectedDate);
  const selectedSchedules = schedules.flatMap((schedule) => {
    const labels = getScheduleLabelsForDate(schedule, selectedDate);
    return labels.length > 0 ? [{ schedule, labels }] : [];
  });

  function movePeriod(amount: number) {
    if (monthView) {
      setVisibleMonth((month) => shiftMonth(month, amount));
      setSelectedDate((date) => {
        const [year, month] = shiftMonth(date.slice(0, 7), amount).split("-").map(Number);
        const day = Math.min(Number(date.slice(8, 10)), new Date(Date.UTC(year, month, 0)).getUTCDate());
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      });
    } else {
      setSelectedDate((date) => addCalendarDays(date, amount * 7));
    }
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setVisibleMonth(dateKey.slice(0, 7));
  }

  return (
    <section className="community-calendar" id="local-calendar" aria-labelledby="calendar-title">
      <div className="calendar-heading">
        <div>
          <span className="section-kicker">동네 소식</span>
          <h3 id="calendar-title">생활 캘린더</h3>
          <p>날짜 안에서 일정을 살펴보고, 선택하면 자세한 내용을 볼 수 있어요.</p>
        </div>
        <button
          className="calendar-view-toggle"
          type="button"
          aria-pressed={monthView}
          onClick={() => {
            setMonthView((visible) => !visible);
            setVisibleMonth(selectedDate.slice(0, 7));
          }}
        >
          {monthView ? "주간 보기" : "월간 달력 보기"}
        </button>
      </div>

      <div className="calendar-period-control">
        <button type="button" onClick={() => movePeriod(-1)} aria-label={monthView ? "이전 달" : "이전 주"}>
          <ChevronLeft size={18} />
        </button>
        <strong>
          {monthView
            ? formatKoreanDate(`${visibleMonth}-01`, { year: "numeric", month: "long" })
            : `${formatKoreanDate(dateKeys[0], { month: "long", day: "numeric" })} – ${formatKoreanDate(dateKeys[6], { month: "long", day: "numeric" })}`}
        </strong>
        <button type="button" onClick={() => movePeriod(1)} aria-label={monthView ? "다음 달" : "다음 주"}>
          <ChevronRight size={18} />
        </button>
        <button className="calendar-today-button" type="button" onClick={() => selectDate(today)}>오늘</button>
      </div>

      <div className="calendar-board-scroll">
      <div className="calendar-board">
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className={`calendar-date-grid${monthView ? " is-month-view" : ""}`} role="group" aria-label="날짜 선택">
        {dateKeys.map((dateKey, index) => {
          const inVisibleMonth = dateKey.startsWith(visibleMonth);
          const daySchedules = schedules.filter(
            (schedule) => getScheduleLabelsForDate(schedule, dateKey).length > 0,
          );
          return (
            <button
              className={[
                "calendar-date",
                index % 7 === 5 ? "is-saturday" : "",
                index % 7 === 6 ? "is-sunday" : "",
                selectedDate === dateKey ? "is-selected" : "",
                today === dateKey ? "is-today" : "",
                monthView && !inVisibleMonth ? "is-outside-month" : "",
              ].filter(Boolean).join(" ")}
              key={dateKey}
              type="button"
              aria-pressed={selectedDate === dateKey}
              aria-label={`${formatKoreanDate(dateKey, {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}${daySchedules.length ? ` · ${daySchedules.map((schedule) => schedule.title).join(" · ")}` : " · 일정 없음"}`}
              onClick={() => selectDate(dateKey)}
            >
              <span className="calendar-day-number"><strong>{Number(dateKey.slice(8, 10))}</strong>{today === dateKey && <em>오늘</em>}</span>
              <span className="calendar-cell-events">
                {daySchedules.slice(0, 2).map((schedule) => <span className="calendar-event-title" key={schedule.id} title={schedule.title}>{schedule.title}</span>)}
                {daySchedules.length > 2 && <span className="calendar-event-more">+{daySchedules.length - 2}개 더 보기</span>}
              </span>
            </button>
          );
        })}
      </div>
      </div>
      </div>

      <div className="calendar-schedule-list" aria-live="polite">
        <h4>
          <CalendarDays size={16} />
          {formatKoreanDate(selectedDate, { month: "long", day: "numeric", weekday: "long" })}
        </h4>
        {selectedSchedules.length === 0 ? (
          <p className="calendar-empty">
            이날은 등록된 일정이 없어요. 다른 날짜의 소식을 살펴보세요.
          </p>
        ) : (
          selectedSchedules.map(({ schedule, labels }) => (
            <article className="calendar-schedule" key={schedule.id}>
              <div>
                <strong>{schedule.title}</strong>
                <p>{schedule.regionName} · {labels.join(" · ")}</p>
                <p>출처: 2026년 {schedule.sourceName} · 확인 {schedule.checkedAt}</p>
                {"terms" in schedule && schedule.terms === "KOGL-4" && <p>공공누리 제4유형 · 출처표시·비상업적 이용·변경금지</p>}
              </div>
              {/^https?:\/\//i.test(schedule.sourceUrl) && (
                <a href={schedule.sourceUrl} target="_blank" rel="noreferrer">
                  공식 안내 <ExternalLink size={14} />
                </a>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
