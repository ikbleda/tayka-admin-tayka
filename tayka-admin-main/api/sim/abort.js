const { getBackendBaseUrl, copyHeader, readRawBody, sendUpstreamResponse } = require('../_utils')

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const base = getBackendBaseUrl()
  if (!base) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'BACKEND_URL is not set' }))
    return
  }

  const upstreamUrl = `${base}/api/sim/abort`

  try {
    const rawBody = await readRawBody(req)

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        accept: copyHeader(req, 'accept') || 'application/json, text/plain, */*',
        'content-type': copyHeader(req, 'content-type') || 'application/json',
        authorization: copyHeader(req, 'authorization') || '',
        'ngrok-skip-browser-warning': 'true',
      },
      body: rawBody && rawBody.length ? rawBody : undefined,
    })

    const bodyText = await upstreamRes.text()
    sendUpstreamResponse(res, upstreamRes, bodyText)
  } catch (e) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Upstream fetch failed', message: String(e?.message || e) }))
  }
}
