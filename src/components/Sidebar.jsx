import React, { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { RiDashboardFill, RiArchiveDrawerLine, RiFileListLine, RiUser3Line, RiCalendarEventLine, RiShieldKeyholeLine } from 'react-icons/ri'
import { BsBarChartFill } from 'react-icons/bs'
import { getRole } from '../utils/auth'
import { ACTIONS, can, isAdmin } from '../utils/rbac'
// https://react-icons.github.io/react-icons/
export default function Sidebar() {
	const location = useLocation()
	const isCompact = useMemo(() => {
		const p = String(location?.pathname || '')
		return p.startsWith('/operasyon') || p.startsWith('/simulasyon')
	}, [location?.pathname])

	const role = getRole?.()
	const showOperation = isAdmin(role) || can(role, ACTIONS.START_OPERATION)
	const showSimulation = isAdmin(role) || can(role, ACTIONS.START_SIMULATION)
	const showManagement = isAdmin(role)

	return (
		<aside className={isCompact ? 'sidebar is-compact' : 'sidebar'} aria-label="Ana menü" tabIndex={0}>
			<div className="sidebar-brand">
				<img className="sidebar-logo" src="/logo.png" alt="AŞİNA TAYKA" />
			</div>
			<nav>
				{showOperation ? (
					<NavLink to="/operasyon" className={({ isActive }) => (isActive ? 'active' : '')}>
						<RiDashboardFill className="icon" />
						<span className="sidebar-label">Operasyon</span>
					</NavLink>
				) : null}

				{showSimulation ? (
					<NavLink to="/simulasyon" className={({ isActive }) => (isActive ? 'active' : '')}>
						<BsBarChartFill className="icon" />
						<span className="sidebar-label">Simülasyon</span>
					</NavLink>
				) : null}

				<NavLink to="/gorev-ozeti" className={({ isActive }) => (isActive ? 'active' : '')}>
					<RiFileListLine className="icon" />
					<span className="sidebar-label">Görev Özeti</span>
				</NavLink>

				<NavLink to="/arsiv" className={({ isActive }) => (isActive ? 'active' : '')}>
					<RiArchiveDrawerLine className="icon" />
					<span className="sidebar-label">Arşiv</span>
				</NavLink>

				{showManagement ? (
					<>
						<div className="sidebar-divider" />
						<div className="sidebar-section">Yönetim</div>

						<NavLink to="/yonetim/kullanicilar" className={({ isActive }) => (isActive ? 'active sub' : 'sub')}>
							<RiUser3Line className="icon" />
							<span className="sidebar-label">Kullanıcılar</span>
						</NavLink>

						<NavLink to="/yonetim/etkinlik" className={({ isActive }) => (isActive ? 'active sub' : 'sub')}>
							<RiCalendarEventLine className="icon" />
							<span className="sidebar-label">Etkinlik</span>
						</NavLink>

						<NavLink to="/yonetim/yetkilendirme" className={({ isActive }) => (isActive ? 'active sub' : 'sub')}>
							<RiShieldKeyholeLine className="icon" />
							<span className="sidebar-label">Yetkilendirme</span>
						</NavLink>
					</>
				) : null}
			</nav>
		</aside>
	)
}