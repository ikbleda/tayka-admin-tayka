import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '')

	const proxyTarget = env.VITE_API_PROXY_TARGET
	const stripPrefix = String(env.VITE_API_PROXY_STRIP_PREFIX || 'true').toLowerCase() !== 'false'

	return {
		plugins: [react()],
		server: proxyTarget
			? {
					proxy: {
						'/api': {
							target: proxyTarget,
							changeOrigin: true,
							secure: false,
							rewrite: stripPrefix ? (path) => path.replace(/^\/api/, '') : undefined,
						},
						// Backend health endpoint is /health (no /api prefix)
						'/health': {
							target: proxyTarget,
							changeOrigin: true,
							secure: false,
						},
					},
				}
			: undefined,
	}
})