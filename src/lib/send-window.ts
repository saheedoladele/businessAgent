/**
 * Only send cold email on weekdays during working hours in the prospects'
 * timezone: emails arriving at 3am look automated and get ignored.
 * Configure with SEND_WINDOW="08:00-17:30" and SEND_TIMEZONE="Africa/Lagos".
 */
export function isWithinSendWindow(
  now = new Date(),
  window = process.env.SEND_WINDOW || "08:00-17:30",
  timeZone = process.env.SEND_TIMEZONE || "UTC",
  weekdaysOnly = process.env.SEND_WEEKENDS !== "true",
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  if (weekdaysOnly && ["Sat", "Sun"].includes(get("weekday"))) return false;

  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const [start, end] = window.split("-").map((hm) => {
    const [h, m = "0"] = hm.trim().split(":");
    return Number(h) * 60 + Number(m);
  });
  return minutes >= start && minutes < end;
}
