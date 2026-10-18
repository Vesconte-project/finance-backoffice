import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBackendContract } from '../lib/backend-contract'

test('accepts a complete backend contract manifest', () => {
  const contract = parseBackendContract({
    contract_version: '2026-07-23.1',
    api_version: '0.1.0',
    path_count: 1,
    operation_count: 1,
    operations: [
      {
        method: 'GET',
        path: '/v1/admin/contracts',
        operation_id: 'get_api_contract_admin_contracts_get',
        summary: 'get api contract',
        audience: 'backoffice',
        auth: 'clerk-session-jwt',
        auth_notes: 'Current session JWT and exact internal administrative permission required.',
        owner: 'backend',
        status: 'stable',
        consumers: ['backoffice'],
      },
    ],
  })

  assert.equal(contract.operation_count, 1)
  assert.equal(contract.operations[0].path, '/v1/admin/contracts')
})

test('rejects an incomplete backend contract manifest', () => {
  assert.throws(
    () => parseBackendContract({ contract_version: '2026-07-23.1', operations: [] }),
    /BACKEND_CONTRACT_INVALID/
  )
})
