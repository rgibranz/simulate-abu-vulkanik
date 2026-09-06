import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './', // biar bisa di-host di subfolder (GitHub Pages)
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
})
