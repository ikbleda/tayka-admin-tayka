import React, { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import { getAuth, logout } from '../utils/auth'
import { useAppState } from '../context/AppState'

export default function Layout() {
const navigate = useNavigate()
const location = useLocation()
const { addActivity } = useAppState() || {}
const lastPathRef = useRef(null)

useEffect(() => {
	if (!addActivity) return
	const path = `${location.pathname || ''}${location.search || ''}`
	if (!path) return
	if (lastPathRef.current === path) return
	lastPathRef.current = path

	const auth = getAuth?.()
	addActivity({
		user: auth?.email || 'admin',
		category: 'Navigasyon',
		comment: `Sayfa görüntülendi: ${path}`,
	})
}, [location.pathname, location.search, addActivity])

async function handleLogout() {
	const auth = getAuth?.()
	addActivity?.({
		user: auth?.email || 'admin',
		category: 'Oturum',
		comment: 'Çıkış yapıldı',
	})
	await logout()
	navigate('/login')
}

return (
<div className="app-root">
<div className="topbar-wrap">
	<Topbar onLogout={handleLogout} />
</div>
<div className="app-body">
<Sidebar />
<main className="main-content">
<section className="content-area">
<Outlet />
</section>
</main>
</div>
</div>
)
}