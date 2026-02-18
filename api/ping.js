module.exports = async (_req, res) => {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ ok: true, service: 'tayka-admin-vercel-functions' }))
}
