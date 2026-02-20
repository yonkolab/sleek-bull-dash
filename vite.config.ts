import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  server: {
    port: 3001,
    strictPort: false, // auto-increment se a porta estiver ocupada
  },
  optimizeDeps: {
    // ssh2 and cpu-features ship native .node binaries that esbuild cannot bundle
    exclude: ['ssh2', 'cpu-features'],
  },
  ssr: {
    // Keep ssh2 as an external CJS require so Node.js handles the native addons
    external: ['ssh2', 'cpu-features'],
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
