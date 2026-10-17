import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const contractPath = process.env.FINANCE_BACKEND_CONTRACT_PATH

if (!contractPath) {
  throw new Error('FINANCE_BACKEND_CONTRACT_PATH is required and must point to finance-backend/docs/api-contract.json.')
}

const contract = JSON.parse(await readFile(resolve(contractPath), 'utf8'))
if (!Array.isArray(contract.operations)) {
  throw new Error('Backend contract does not contain an operations array.')
}

const manifestOperations = new Map(
  contract.operations.map((operation) => [
    operationKey(operation.method, operation.path),
    operation,
  ])
)
const proxyTargets = await collectProxyTargets(resolve(repositoryRoot, 'app/api'))
const missingTargets = []
const unsupportedAudienceTargets = []

for (const target of proxyTargets) {
  const operation = manifestOperations.get(operationKey(target.method, target.path))
  if (!operation) {
    missingTargets.push(target)
    continue
  }
  if (!operation.consumers.includes('backoffice') && !operation.consumers.includes('frontoffice')) {
    unsupportedAudienceTargets.push({ ...target, consumers: operation.consumers })
  }
}

if (missingTargets.length || unsupportedAudienceTargets.length) {
  const messages = []
  if (missingTargets.length) {
    messages.push(`Proxy targets absent from finance-backend contract:\n${formatTargets(missingTargets)}`)
  }
  if (unsupportedAudienceTargets.length) {
    messages.push(`Proxy targets not declared for a UI consumer:\n${formatTargets(unsupportedAudienceTargets)}`)
  }
  throw new Error(messages.join('\n\n'))
}

const declaredForBackoffice = contract.operations.filter((operation) => operation.consumers.includes('backoffice')).length
console.log(`Validated ${proxyTargets.length} Backoffice proxy targets against contract ${contract.contract_version}.`)
console.log(`${declaredForBackoffice} backend operations are intended for Backoffice; proxy coverage is intentionally not required to be exhaustive.`)

async function collectProxyTargets(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const targets = []
  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      targets.push(...await collectProxyTargets(entryPath))
      continue
    }
    if (entry.name !== 'route.ts' && entry.name !== 'admin-action.ts') continue
    const source = await readFile(entryPath, 'utf8')
    targets.push(...extractProxyTargets(source, entryPath))
  }
  return targets
}

function extractProxyTargets(source, sourcePath) {
  const calls = [...source.matchAll(/(?:proxyBackendJson|requestBackendResponse)\s*\(\s*\{/g)]
  const canonicalCalls = [...source.matchAll(/proxyCanonicalTickerResource\s*\(\s*\{[\s\S]*?resource:\s*'([^']+)'[\s\S]*?\}\s*\)/g)]
  const actionValues = [...source.matchAll(/type\s+ResearchAdminAction\s*=\s*([^\n]+)/g)]
    .flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]))
  const targets = []

  for (const match of canonicalCalls) {
    targets.push({
      method: 'GET',
      path: `/v1/admin/tickers/{}/${match[1]}`,
      source: sourcePath.replace(`${repositoryRoot}/`, ''),
    })
  }

  for (let index = 0; index < calls.length; index += 1) {
    const start = calls[index].index
    const end = calls[index + 1]?.index ?? source.length
    const block = source.slice(start, end)
    const pathMatch = block.match(/path:\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/)
    const methodMatch = block.match(/method:\s*'([A-Z]+)'/)
    if (!pathMatch || !methodMatch) {
      throw new Error(`Could not extract path and method from proxy call in ${sourcePath}.`)
    }

    const pathTemplate = pathMatch[1] ?? pathMatch[2] ?? pathMatch[3]
    const expandedPaths = pathTemplate.includes('${action}')
      ? actionValues.map((action) => pathTemplate.replace('${action}', action))
      : [pathTemplate]
    if (!expandedPaths.length) {
      throw new Error(`Could not expand action proxy path in ${sourcePath}.`)
    }

    for (const path of expandedPaths) {
      targets.push({
        method: methodMatch[1],
        path: normalizePath('/v1/admin'+path),
        source: sourcePath.replace(`${repositoryRoot}/`, ''),
      })
    }
  }
  return targets
}

function operationKey(method, path) {
  return `${method.toUpperCase()} ${normalizePath(path)}`
}

function normalizePath(path) {
  return path
    .replace(/\$\{[^}]+\}/g, '{}')
    .replace(/\{[^}]+\}/g, '{}')
}

function formatTargets(targets) {
  return targets.map((target) => `- ${target.method} ${target.path} (${target.source})`).join('\n')
}
