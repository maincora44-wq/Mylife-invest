// src/utils/timeUtils.ts
// Real-time Event Countdown & D-Day Engine for Investment OS

export interface EventTimeAnalysis {
  targetDate: Date;
  isValidDate: boolean;
  dDay: number; // positive = future (e.g. 5 means D-5), 0 = D-Day, negative = past (e.g. -1 means D+1)
  dDayBadge: string; // "D-5", "D-Day", "D+1"
  countdownText: string; // "118시간 남음", "2시간 14분 남음", "발표 완료"
  isToday: boolean;
  isCoolingActive: boolean; // currently inside pre/post event cooling period
  minutesUntilEvent: number;
}

/**
 * Parses Korean KST date strings like "2026-09-17 03:00 KST" or ISO strings into a Date object
 */
export function parseKSTDateTime(dateStr: string): Date {
  if (!dateStr) return new Date();

  // If already standard ISO
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }

  // Format: "YYYY-MM-DD HH:mm KST" or "YYYY-MM-DD"
  const cleaned = dateStr.replace(" KST", "").trim();
  const parts = cleaned.split(" ");
  const datePart = parts[0]; // "YYYY-MM-DD"
  const timePart = parts[1] || "09:00"; // default 09:00 KST if time omitted

  // Construct ISO with +09:00 KST offset
  const isoStr = `${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}+09:00`;
  const parsed = new Date(isoStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback direct parse
  const fallback = new Date(cleaned);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Computes live real-time D-Day and countdown for an event
 */
export function analyzeEventTime(
  eventTimeKST: string,
  coolingPeriodMin: number = 30,
  currentDate: Date = new Date()
): EventTimeAnalysis {
  const targetDate = parseKSTDateTime(eventTimeKST);
  const now = currentDate.getTime();
  const target = targetDate.getTime();
  const diffMs = target - now;

  const minutesUntilEvent = Math.round(diffMs / (1000 * 60));

  // Midnight comparison for calendar D-day (in KST timezone)
  const nowKST = new Date(now + 9 * 60 * 60 * 1000);
  const targetKST = new Date(target + 9 * 60 * 60 * 1000);

  const nowMidnight = Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), nowKST.getUTCDate());
  const targetMidnight = Date.UTC(targetKST.getUTCFullYear(), targetKST.getUTCMonth(), targetKST.getUTCDate());

  const dayDiff = Math.round((targetMidnight - nowMidnight) / (24 * 60 * 60 * 1000));

  let dDayBadge = "";
  if (dayDiff > 0) {
    dDayBadge = `D-${dayDiff}`;
  } else if (dayDiff === 0) {
    dDayBadge = "D-Day";
  } else {
    dDayBadge = `D+${Math.abs(dayDiff)}`;
  }

  // Countdown text
  let countdownText = "";
  const isCoolingActive = Math.abs(minutesUntilEvent) <= coolingPeriodMin;

  if (isCoolingActive) {
    if (minutesUntilEvent > 0) {
      countdownText = `발표 직전 ${minutesUntilEvent}분 전 (냉각 ON)`;
    } else {
      countdownText = `발표 직후 ${Math.abs(minutesUntilEvent)}분 경과 (냉각 중)`;
    }
  } else if (diffMs > 0) {
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const remMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (totalHours >= 48) {
      const days = Math.floor(totalHours / 24);
      countdownText = `${days}일 남음`;
    } else if (totalHours > 0) {
      countdownText = `${totalHours}시간 ${remMinutes}분 남음`;
    } else {
      countdownText = `${remMinutes}분 남음 (임박)`;
    }
  } else {
    countdownText = "이벤트 종료 (결과 반영됨)";
  }

  return {
    targetDate,
    isValidDate: true,
    dDay: dayDiff,
    dDayBadge,
    countdownText,
    isToday: dayDiff === 0,
    isCoolingActive,
    minutesUntilEvent,
  };
}
