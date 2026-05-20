const BROWSER_LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/
const MIN_TIMEZONE_OFFSET_MINUTES = -14 * 60
const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60

export interface BrowserLocalDateTimeParseResult {
  date: Date
  displayText: string
}

function parseDateTimeParts(input: string) {
  const matched = input.trim().match(BROWSER_LOCAL_DATETIME_PATTERN)

  if (!matched) {
    return null
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = matched
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  }

  if (Object.values(parts).some((value) => !Number.isInteger(value))) {
    return null
  }

  const localTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const validationDate = new Date(localTimestamp)

  if (
    validationDate.getUTCFullYear() !== parts.year
    || validationDate.getUTCMonth() !== parts.month - 1
    || validationDate.getUTCDate() !== parts.day
    || validationDate.getUTCHours() !== parts.hour
    || validationDate.getUTCMinutes() !== parts.minute
    || validationDate.getUTCSeconds() !== parts.second
  ) {
    return null
  }

  return {
    ...parts,
    localTimestamp,
  }
}

export function isValidTimezoneOffsetMinutes(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= MIN_TIMEZONE_OFFSET_MINUTES
    && value <= MAX_TIMEZONE_OFFSET_MINUTES
}

export function formatBrowserLocalDateTimeInput(input: string) {
  const parts = parseDateTimeParts(input)

  if (!parts) {
    return ""
  }

  const dateText = [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-")
  const timeText = [
    String(parts.hour).padStart(2, "0"),
    String(parts.minute).padStart(2, "0"),
  ].join(":")

  return `${dateText} ${timeText}`
}

export function parseBrowserLocalDateTime(input: string, timezoneOffsetMinutes: number): BrowserLocalDateTimeParseResult | null {
  if (!isValidTimezoneOffsetMinutes(timezoneOffsetMinutes)) {
    return null
  }

  const parts = parseDateTimeParts(input)

  if (!parts) {
    return null
  }

  const date = new Date(parts.localTimestamp + timezoneOffsetMinutes * 60 * 1000)

  return Number.isNaN(date.getTime())
    ? null
    : {
      date,
      displayText: formatBrowserLocalDateTimeInput(input),
    }
}
