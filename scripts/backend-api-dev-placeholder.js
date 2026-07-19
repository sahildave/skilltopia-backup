/**
 * Placeholder frontend for `vercel dev` so the CLI does not start Vite.
 * Tauri owns Vite on :1420; this process only satisfies Vercel's PORT handshake.
 * Real traffic for skills is /api/* (handled by Vercel, not this server).
 */
import http from 'node:http'

const port = Number(process.env.PORT) || 3333

http
  .createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Backend API only. Use /api/* (Tauri owns the Vite UI).\n')
  })
  .listen(port, () => {
    console.log(`API-only placeholder listening on :${port}`)
  })
