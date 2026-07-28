// Server sends naive UTC timestamps (no offset suffix). `new Date(str)` parses
// an offset-less date-time string as local time, not UTC, so every display
// derived from it drifts by the viewer's UTC offset. Normalize by appending
// "Z" when no timezone is present before handing it to Date.
export function parseServerTimestamp(value) {
  if (!value) return null
  const asText = String(value)
  const hasTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(asText)
  const normalized = hasTimezone ? asText : `${asText}Z`
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
