import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 배포 시에만 base 경로 설정 (환경변수로 구분)
  base: process.env.GITHUB_PAGES === 'true' ? '/tipping-project/' : '/',
})
