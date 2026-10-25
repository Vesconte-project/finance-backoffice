import assert from 'node:assert/strict'
import test from 'node:test'
import { parseWeeklyHealth, parseWeeklyCoverage } from '../lib/atlas-weekly-admin'
const health = { generatedAt: '2026-10-25T12:00:00+00:00', status: 'current', expectedWeekStart: '2026-10-19',
  expectedAsOf: '2026-10-23', latestAsOf: '2026-10-23', companyCount: 2, zoneCount: 1 }
const coverage = { generatedAt: health.generatedAt, asOf: '2026-10-23', universeCount: 3, nodeCount: 2,
  excludedCount: 1, exclusionReasonsAvailable: false, exclusionReasons: [{ reason: null, count: 1 }],
  countries: [{ country: 'US', region: 'US', universeCount: 3, nodeCount: 2, excludedCount: 1, coverageRatio: 2 / 3 }] }
test('accepts weekly health and preserves calendar-unavailable state', () => {
  assert.deepEqual(parseWeeklyHealth(health), health)
  assert.equal(parseWeeklyHealth({ ...health, status: 'calendar_unavailable', expectedAsOf: null }).expectedAsOf, null)
})
test('refuses the old daily-map health response', () => {
  assert.throws(() => parseWeeklyHealth({ pipeline: { buildRanToday: true }, rows: [], rollup: { status: 'green' } }))
})
test('preserves unknown exclusion reasons without inventing a cause', () => {
  assert.deepEqual(parseWeeklyCoverage(coverage), coverage)
  assert.equal(parseWeeklyCoverage({ ...coverage, asOf: null, excludedCount: null }).excludedCount, null)
})
test('refuses legacy coverage and malformed weekly counts or ratios', () => {
  assert.throws(() => parseWeeklyCoverage({ summary: { relationshipNodeCount: 2 }, config: { window: 252 } }))
  assert.throws(() => parseWeeklyCoverage({ ...coverage, countries: [{ ...coverage.countries[0], coverageRatio: NaN }] }))
  assert.throws(() => parseWeeklyHealth({ ...health, companyCount: -1 }))
})
