export type WeeklyHealth = {
  generatedAt: string; status: 'current' | 'stale' | 'missing' | 'calendar_unavailable'
  expectedWeekStart: string; expectedAsOf: string | null; latestAsOf: string | null
  companyCount: number; zoneCount: number
}
export type WeeklyCountryCoverage = {
  country: string; region: string; universeCount: number; nodeCount: number
  excludedCount: number | null; coverageRatio: number | null
}
export type WeeklyCoverage = {
  generatedAt: string; asOf: string | null; universeCount: number; nodeCount: number
  excludedCount: number | null; exclusionReasonsAvailable: boolean
  exclusionReasons: { reason: string | null; count: number }[]; countries: WeeklyCountryCoverage[]
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Weekly Atlas contract unavailable')
  return value as Record<string, unknown>
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
function day(value: unknown): boolean {
  return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
}
export function parseWeeklyHealth(value: unknown): WeeklyHealth {
  const row = record(value)
  if (typeof row.generatedAt !== 'string' ||
      !['current', 'stale', 'missing', 'calendar_unavailable'].includes(String(row.status)) ||
      typeof row.expectedWeekStart !== 'string' || !day(row.expectedWeekStart) ||
      !day(row.expectedAsOf) || !day(row.latestAsOf) || !count(row.companyCount) || !count(row.zoneCount)) {
    throw Error('Weekly Atlas contract unavailable')
  }
  return row as WeeklyHealth
}
export function parseWeeklyCoverage(value: unknown): WeeklyCoverage {
  const row = record(value)
  if (typeof row.generatedAt !== 'string' || !day(row.asOf) || !count(row.universeCount) || !count(row.nodeCount) ||
      !(row.excludedCount === null || count(row.excludedCount)) || typeof row.exclusionReasonsAvailable !== 'boolean' ||
      !Array.isArray(row.exclusionReasons) || !Array.isArray(row.countries)) throw Error('Weekly Atlas contract unavailable')
  for (const value of row.countries) {
    const country = record(value)
    if (typeof country.country !== 'string' || typeof country.region !== 'string' ||
        !count(country.universeCount) || !count(country.nodeCount) ||
        !(country.excludedCount === null || count(country.excludedCount)) ||
        !(country.coverageRatio === null || (typeof country.coverageRatio === 'number' &&
          Number.isFinite(country.coverageRatio) && country.coverageRatio >= 0 && country.coverageRatio <= 1))) {
      throw Error('Weekly Atlas contract unavailable')
    }
  }
  for (const value of row.exclusionReasons) {
    const reason = record(value)
    if (!(reason.reason === null || typeof reason.reason === 'string') || !count(reason.count)) throw Error('Weekly Atlas contract unavailable')
  }
  return row as WeeklyCoverage
}
export const healthLabel: Record<WeeklyHealth['status'], string> = {
  current: 'Up to date', stale: 'Behind expected week', missing: 'No closed week published',
  calendar_unavailable: 'Expected close unavailable',
}
