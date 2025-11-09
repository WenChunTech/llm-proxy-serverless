import app from './server.ts'

export default {
  hostname: "0.0.0.0",
  port: 3000,
  fetch: app.fetch,
}
