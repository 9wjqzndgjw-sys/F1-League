import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function swVersionPlugin() {
  return {
    name: 'sw-version',
    closeBundle() {
      const swPath = path.resolve('dist/sw.js')
      if (fs.existsSync(swPath)) {
        const content = fs.readFileSync(swPath, 'utf8')
        fs.writeFileSync(swPath, content.replace('__BUILD_ID__', Date.now()))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
})
