import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let _db: NeonHttpDatabase<typeof schema> | undefined

function getDatabase(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not configured')
    _db = drizzle(neon(url), { schema })
  }
  return _db
}

// Proxy defers neon() call until first actual DB access (not at import/build time)
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_, prop) {
    return getDatabase()[prop as keyof NeonHttpDatabase<typeof schema>]
  },
})
