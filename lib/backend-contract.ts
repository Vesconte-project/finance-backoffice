import { requestBackendJson } from './backend-client'

export type BackendContractOperation = {
  method: string
  path: string
  operation_id: string
  summary: string
  audience: string
  auth: string
  auth_notes: string
  owner: string
  status: string
  consumers: string[]
}

export type BackendContract = {
  contract_version: string
  api_version: string
  path_count: number
  operation_count: number
  operations: BackendContractOperation[]
}

export async function fetchBackendContract(): Promise<BackendContract> {
  const { payload } = await requestBackendJson({
    path: '/contracts',

  })
  return parseBackendContract(payload)
}

export function parseBackendContract(payload: unknown): BackendContract {
  if (!isRecord(payload) || !Array.isArray(payload.operations)) {
    throw new Error('BACKEND_CONTRACT_INVALID')
  }

  const operations = payload.operations.map((operation) => {
    if (!isRecord(operation) || !Array.isArray(operation.consumers)) {
      throw new Error('BACKEND_CONTRACT_INVALID')
    }
    return {
      method: readString(operation.method),
      path: readString(operation.path),
      operation_id: readString(operation.operation_id),
      summary: readString(operation.summary),
      audience: readString(operation.audience),
      auth: readString(operation.auth),
      auth_notes: readString(operation.auth_notes),
      owner: readString(operation.owner),
      status: readString(operation.status),
      consumers: operation.consumers.map(readString),
    }
  })

  const contract = {
    contract_version: readString(payload.contract_version),
    api_version: readString(payload.api_version),
    path_count: readNumber(payload.path_count),
    operation_count: readNumber(payload.operation_count),
    operations,
  }
  if (contract.operation_count !== contract.operations.length) {
    throw new Error('BACKEND_CONTRACT_INVALID')
  }
  return contract
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('BACKEND_CONTRACT_INVALID')
  }
  return value
}

function readNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('BACKEND_CONTRACT_INVALID')
  }
  return value
}
