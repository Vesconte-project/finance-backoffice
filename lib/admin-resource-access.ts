export class ResourceAccessInputError extends Error {
  constructor(readonly status: 400 | 413) { super(status === 413 ? 'Resource access request is too large.' : 'Invalid resource access request.') }
}

export async function readResourceAccessBody(request: Request): Promise<unknown> {
  const maximum = 8192
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new ResourceAccessInputError(400)
  if (Number(request.headers.get('content-length')) > maximum) throw new ResourceAccessInputError(413)
  if (!request.body) throw new ResourceAccessInputError(400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximum) { await reader.cancel(); throw new ResourceAccessInputError(413) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch (error) {
    if (error instanceof ResourceAccessInputError) throw error
    throw new ResourceAccessInputError(400)
  } finally { reader.releaseLock() }
}
