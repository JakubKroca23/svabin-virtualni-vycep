import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE || '/svabin-virtualni-vycep/',
  test: {
    environment: 'node',
  },
});
