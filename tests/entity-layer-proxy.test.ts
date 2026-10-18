import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = [
  ['summary', '/analyst/entity-layer/summary'],
  ['dedup', '/analyst/entity-layer/dedup'],
  ['tail', '/analyst/entity-layer/tail'],
  ['source-health', '/analyst/entity-layer/source-health'],
  ['entities', '/analyst/entity-layer/entities'],
  ['review', '/analyst/entity-layer/review'],
] as const

describe('Entity Layer Proxy Routes', () => {
  it('should proxy all read-only analyst routes behind admin auth', () => {
    for (const [route, backendPath] of routes) {
      const source = readFileSync(join(process.cwd(), 'app/api/entity-layer', route, 'route.ts'), 'utf8')
      assert.match(source, /export async function GET/)
      assert.match(source, /withAdminRoute/)
      assert.match(source, /proxyBackendJson/)
      assert.match(source, new RegExp(`path: '${backendPath}'`))
      assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
    }
  })

  it('proxies financial statements through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/financial-statements/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'financial-statements'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies market metrics through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/market-metrics/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'market-metrics'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies earnings events through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/earnings-events/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'earnings-events'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies latest enriched earnings through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/earnings-events/latest/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'earnings-events\/latest'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies corporate actions through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/corporate-actions/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'corporate-actions'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies filings through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/filings/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'filings'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies investor events through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/investor-events/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'investor-events'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies guidance through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/guidance/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'guidance'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies data control coverage and source health through admin-only read routes', () => {
    for (const [route, backendPath] of [['coverage', '/data-control/coverage'], ['calendar', '/data-control/calendar'], ['disclosures', '/data-control/disclosures'], ['domains', '/data-control/domains'], ['sources', '/data-control/sources']]) {
      const source = readFileSync(join(process.cwd(), 'app/api/data-control', route, 'route.ts'), 'utf8')
      assert.match(source, /export async function GET/)
      assert.match(source, /withAdminRoute/)
      assert.match(source, /proxyBackendJson/)
      assert.match(source, new RegExp(`path: '${backendPath}'`))
      assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
    }
  })

  it('proxies equity capital events through an admin-only read route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/equity-capital-events/route.ts'), 'utf8')
    assert.match(source, /export async function GET/)
    assert.match(source, /withAdminRoute/)
    assert.match(source, /proxyCanonicalTickerResource/)
    assert.match(source, /resource: 'equity-capital-events'/)
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('proxies fund distributions canonically and keeps global rebalances administrative', () => {
    const distributions = readFileSync(join(process.cwd(), 'app/api/fund-distributions/route.ts'), 'utf8')
    assert.match(distributions, /proxyCanonicalTickerResource/)
    assert.match(distributions, /resource: 'fund-distributions'/)
    const rebalances = readFileSync(join(process.cwd(), 'app/api/fund-rebalances/route.ts'), 'utf8')
    assert.match(rebalances, /proxyBackendJson/)
    assert.match(rebalances, /path: '\/fund-rebalances'/)
    assert.doesNotMatch(distributions + rebalances, /export async function (POST|PUT|PATCH|DELETE)/)
  })

  it('renders fund-event pages as temporal canonical audit surfaces', () => {
    const distributions = readFileSync(join(process.cwd(), 'components/fund-distributions/FundDistributionsWorkspace.tsx'), 'utf8')
    const rebalances = readFileSync(join(process.cwd(), 'components/fund-rebalances/FundRebalancesWorkspace.tsx'), 'utf8')
    assert.match(distributions, /Temporal PIT canonical distributions/)
    assert.match(distributions, /observationConfidence/)
    assert.match(rebalances, /Holdings snapshots are not inferred/)
    assert.match(rebalances, /observationConfidence/)
    assert.doesNotMatch(distributions, /source_cache/)
    assert.doesNotMatch(rebalances, /source_cache/)
  })

  it('renders equity capital events as a temporal candidate-inspection surface', () => {
    const source = readFileSync(join(process.cwd(), 'components/equity-capital-events/EquityCapitalEventsWorkspace.tsx'), 'utf8')
    assert.match(source, /Temporal PIT canonical candidates/)
    assert.match(source, /equityCapitalCandidate/)
    assert.match(source, /extractionConfidence/)
    assert.match(source, /fieldProvenance/)
    assert.doesNotMatch(source, /source_cache/)
    assert.doesNotMatch(source, /fetch\(/)
  })

  it('renders data control as a paged universe and source-health operational surface', () => {
    const source = readFileSync(join(process.cwd(), 'components/data-control/DataControlWorkspace.tsx'), 'utf8')
    assert.match(source, /Tracked universe coverage/)
    assert.match(source, /Canonical pipeline inventory/)
    assert.match(source, /Source lineage/)
    assert.match(source, /Operational calendar/)
    assert.match(source, /Disclosure monitor/)
    assert.match(source, /Low confidence/)
    assert.match(source, /COVERAGE_PAGE_SIZE/)
    assert.match(source, /successful empty build means no safe canonical observations/)
    assert.doesNotMatch(source, /source_cache/)
    assert.doesNotMatch(source, /fetch\(/)
  })

  it('renders investor events as a temporal candidate-inspection surface', () => {
    const source = readFileSync(join(process.cwd(), 'components/investor-events/InvestorEventsWorkspace.tsx'), 'utf8')
    assert.match(source, /Temporal PIT canonical candidates/)
    assert.match(source, /candidate/)
    assert.match(source, /unconfirmed/)
    assert.match(source, /fieldProvenance/)
    assert.match(source, /providerObservations/)
    assert.doesNotMatch(source, /source_cache/)
    assert.doesNotMatch(source, /fetch\(/)
  })

  it('renders guidance as a temporal candidate-inspection surface', () => {
    const source = readFileSync(join(process.cwd(), 'components/guidance/GuidanceWorkspace.tsx'), 'utf8')
    assert.match(source, /Temporal PIT canonical guidance candidates/)
    assert.match(source, /guidanceCandidate/)
    assert.match(source, /unconfirmed/)
    assert.match(source, /fieldProvenance/)
    assert.match(source, /providerObservations/)
    assert.doesNotMatch(source, /source_cache/)
    assert.doesNotMatch(source, /fetch\(/)
  })

  it('labels entity-tail EAS market cap as latest metadata, not provider/local data', () => {
    const source = readFileSync(join(process.cwd(), 'components/entity-layer/EntityLayerWorkspace.tsx'), 'utf8')
    assert.match(source, /Latest metadata market cap/)
    assert.doesNotMatch(source, /Provider\/local market cap/)
  })
})
