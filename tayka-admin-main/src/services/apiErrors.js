export function createApiNotConfiguredError(name) {
  const err = new Error(`${name} API not configured`)
  err.code = 'API_NOT_CONFIGURED'
  err.apiName = name
  return err
}

export function isApiNotConfiguredError(err) {
  return err?.code === 'API_NOT_CONFIGURED'
}
