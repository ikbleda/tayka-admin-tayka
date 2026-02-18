function getBackendBaseUrl() {
  const raw = process.env.BACKEND_URL || process.env.API_BASE_URL || ''
  return String(raw || '').replace(/\/$/, '')
}

function copyHeader(req, name) {
  const v = req.headers?.[name]
  if (v === undefined) return undefined
  if (Array.isArray(v)) return v.join(',')
  return String(v)
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function sendUpstreamResponse(res, upstreamRes, bodyText) {
  // Pass through content-type to keep JSON/text.
  const contentType = upstreamRes.headers.get('content-type')
  if (contentType) res.setHeader('content-type', contentType)

  res.statusCode = upstreamRes.status
  res.end(bodyText)
}

module.exports = {
  getBackendBaseUrl,
  copyHeader,
  readRawBody,
  sendUpstreamResponse,
}
