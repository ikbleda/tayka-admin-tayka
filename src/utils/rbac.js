export const ROLES = {
  ADMIN: 'ADMIN',
  COMMANDER: 'COMMANDER',
  OPERATOR: 'OPERATOR',
  ANALYST: 'ANALYST',
  OBSERVER: 'OBSERVER',
}

export const ACTIONS = {
  VIEW_MANAGEMENT: 'VIEW_MANAGEMENT',
  MANAGE_USERS: 'MANAGE_USERS',
  START_OPERATION: 'START_OPERATION',
  END_OPERATION: 'END_OPERATION',
  START_SIMULATION: 'START_SIMULATION',
  ABORT_SIMULATION: 'ABORT_SIMULATION',
  APPROVE_RECOMMENDATION: 'APPROVE_RECOMMENDATION',
  SELECT_MODULE_OPERATION: 'SELECT_MODULE_OPERATION',
  SELECT_MODULE_SIMULATION: 'SELECT_MODULE_SIMULATION',
}

export function normalizeTrAscii(input) {
  return String(input || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('İ', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
}

export function roleLabel(role) {
  switch (role) {
    case ROLES.ADMIN:
      return 'Yönetici'
    case ROLES.COMMANDER:
      return 'Komutan'
    case ROLES.OPERATOR:
      return 'Operatör'
    case ROLES.ANALYST:
      return 'Analist'
    case ROLES.OBSERVER:
      return 'Gözlemci'
    default:
      return String(role || '-')
  }
}

export function can(role, action) {
  const r = role || ROLES.OBSERVER
  if (r === ROLES.ADMIN) return true

  switch (action) {
    case ACTIONS.VIEW_MANAGEMENT:
    case ACTIONS.MANAGE_USERS:
      return false

    case ACTIONS.START_OPERATION:
    case ACTIONS.END_OPERATION:
    case ACTIONS.SELECT_MODULE_OPERATION:
    case ACTIONS.APPROVE_RECOMMENDATION:
      return r === ROLES.COMMANDER || r === ROLES.OPERATOR

    case ACTIONS.START_SIMULATION:
    case ACTIONS.ABORT_SIMULATION:
    case ACTIONS.SELECT_MODULE_SIMULATION:
      return r === ROLES.COMMANDER || r === ROLES.ANALYST

    default:
      return false
  }
}

export function isAdmin(role) {
  return role === ROLES.ADMIN
}

export function defaultRouteForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
    case ROLES.COMMANDER:
    case ROLES.OPERATOR:
      return '/operasyon'
    case ROLES.ANALYST:
      return '/simulasyon'
    case ROLES.OBSERVER:
    default:
      return '/gorev-ozeti'
  }
}
