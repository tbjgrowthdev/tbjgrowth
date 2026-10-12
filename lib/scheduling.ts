// Timezone conversion without a date library — Node's Intl already has
// everything needed (IANA zone data via Intl.supportedValuesOf, and offset
// computation via Intl.DateTimeFormat.formatToParts).

export function listTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

function getOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  // asUtc is "the wall-clock time in `timeZone`, misread as if it were UTC" —
  // subtracting the real instant gives exactly the zone's offset at that time.
  return (asUtc - instant.getTime()) / 60000;
}

// Converts a date+time as entered in a given IANA timezone into the
// absolute UTC instant it represents. Two-pass: the offset can depend on
// the instant itself (DST), so it's computed from a first guess and then
// applied — accurate except in the rare ambiguous hour right at a DST
// transition, same caveat every timezone library carries.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60000);
}

export function formatInTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
