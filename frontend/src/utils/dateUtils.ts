/**
 * Unified Date and Timezone Utilities for Restaurant POS
 * Ensures 100% data consistency across Dashboard, Reports, Daybook, and Orders Hub.
 */

export const getLocalYMD = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getLocalDayRangeISO = (startDateYMD: string, endDateYMD: string = startDateYMD) => {
  const [sy, sm, sd] = startDateYMD.split('-').map(Number);
  const [ey, em, ed] = endDateYMD.split('-').map(Number);

  const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString();
  const end = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();

  return { start, end };
};

export const getTodayRangeISO = () => {
  const todayYMD = getLocalYMD();
  return getLocalDayRangeISO(todayYMD, todayYMD);
};
