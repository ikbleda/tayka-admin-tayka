import React, { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../context/AppState'

export default function LogViewer() {
	const { logs = [] } = useAppState()
	const pageSize = 20
	const [page, setPage] = useState(1)

	const totalPages = Math.max(1, Math.ceil((logs?.length || 0) / pageSize))

	useEffect(() => {
		// keep current page valid if logs length changes
		setPage((p) => Math.min(Math.max(1, p), totalPages))
	}, [totalPages])

	const pageLogs = useMemo(() => {
		const list = Array.isArray(logs) ? logs.slice().reverse() : []
		const start = (page - 1) * pageSize
		return list.slice(start, start + pageSize)
	}, [logs, page])

	return (
		<div>
			<h1>Log Viewer</h1>
			{logs.length === 0 ? (
				<p className="hint">Henüz log yok.</p>
			) : (
				<div className="log-list">
					<table className="events-table">
						<thead>
							<tr>
								<th>Zaman</th>
								<th>İşlem</th>
							</tr>
						</thead>
						<tbody>
							{pageLogs.map((l, idx) => (
								<tr key={`${l.time}-${idx}`}>
									<td>{new Date(l.time).toLocaleString()}</td>
									<td>{l.message}</td>
								</tr>
							))}
						</tbody>
					</table>

					<div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
						<button
							type="button"
							className="btn"
							onClick={() => setPage(1)}
							disabled={page <= 1}
						>
							≪
						</button>

						<button
							type="button"
							className="btn"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page <= 1}
						>
							&lt;
						</button>

						<button type="button" className="btn" disabled aria-current="page">
							{page} / {totalPages}
						</button>

						<button
							type="button"
							className="btn"
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page >= totalPages}
						>
							&gt;
						</button>

						<button
							type="button"
							className="btn"
							onClick={() => setPage(totalPages)}
							disabled={page >= totalPages}
						>
							≫
						</button>
					</div>
				</div>
			)}
		</div>
	)
}