const { getBackendBaseUrl, sendUpstreamResponse } = require('./_utils')

module.exports = async (req, res) => {
  const base = getBackendBaseUrl()
  if (!base) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'BACKEND_URL is not set' }))
    return
  }

  // Health should be simple and fast. Do not forward auth headers.
  const upstreamUrl = `${base}/health`

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        // Helps avoid ngrok interstitial HTML
        'ngrok-skip-browser-warning': 'true',
      },
    })

    const bodyText = await upstreamRes.text()
    sendUpstreamResponse(res, upstreamRes, bodyText)
  } catch (e) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Upstream fetch failed', message: String(e?.message || e) }))
  }
}
