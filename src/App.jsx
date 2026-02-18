import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Events from './pages/Events'
import LogViewer from './pages/LogViewer'
import Simulation from './pages/FakeSimulation'
import Operation from './pages/Operation'
import MissionSummary from './pages/MissionSummary'
import Archive from './pages/Archive'
import Authorization from './pages/Authorization'
import Management from './pages/Management'
import Layout from './components/Layout'
import { getAuth, getRole, isAuthenticated } from './utils/auth'
import { can, defaultRouteForRole, isAdmin, ROLES } from './utils/rbac'
import { AppStateProvider } from './context/AppState'

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}

function Landing() {
  const role = getRole?.() || ROLES.OBSERVER
  return <Navigate to={defaultRouteForRole(role)} replace />
}

function RoleRoute({ children, allowAdminOnly = false, allowRoles = null, allowAction = null }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />

	const role = getRole?.() || getAuth?.()?.role || ROLES.OBSERVER

  if (allowAdminOnly) {
    return isAdmin(role) ? children : <Navigate to={defaultRouteForRole(role)} replace />
  }

  if (Array.isArray(allowRoles) && allowRoles.length > 0) {
    return allowRoles.includes(role) ? children : <Navigate to={defaultRouteForRole(role)} replace />
  }

  if (allowAction) {
    return can(role, allowAction) ? children : <Navigate to={defaultRouteForRole(role)} replace />
  }

  return children
}

export default function App() {
  console.log('App render')
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppStateProvider>
              <Layout />
            </AppStateProvider>
          </ProtectedRoute>
        }
      >
        {/* New section routes */}
        <Route index element={<Landing />} />
       <Route
  path="operasyon"
  element={
    <RoleRoute allowRoles={[ROLES.ADMIN, ROLES.COMMANDER, ROLES.OPERATOR]}>
      <Simulation variant="operasyon" />
    </RoleRoute>
  }
/>

        <Route
      path="simulasyon"
      element={
        <RoleRoute allowRoles={[ROLES.ADMIN, ROLES.COMMANDER, ROLES.ANALYST]}>
          <Simulation />
        </RoleRoute>
      }
    />
        <Route path="gorev-ozeti" element={<MissionSummary />} />
        <Route path="arsiv" element={<Archive />} />

        <Route
          path="yonetim"
          element={
            <RoleRoute allowAdminOnly={true}>
              <Management />
            </RoleRoute>
          }
        >
          <Route index element={<Navigate to="kullanicilar" replace />} />
          <Route path="kullanicilar" element={<Users />} />
          <Route path="etkinlik" element={<Events />} />
          <Route path="yetkilendirme" element={<Authorization />} />
        </Route>

        {/* Backward compatible routes */}
        <Route path="dashboard" element={<Navigate to="/gorev-ozeti" replace />} />
        <Route path="simulation" element={<Navigate to="/simulasyon" replace />} />
        <Route path="users" element={<Navigate to="/yonetim/kullanicilar" replace />} />
        <Route path="events" element={<Navigate to="/yonetim/etkinlik" replace />} />
        <Route path="logs" element={<Navigate to="/operasyon" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
