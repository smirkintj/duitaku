import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY
  if (!k) throw new Error('ENCRYPTION_KEY environment variable is not set')
  const buf = Buffer.from(k, 'base64')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be a 32-byte base64 string (openssl rand -base64 32)')
  return buf
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map(b => b.toString('hex')).join(':')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const [ivHex, tagHex, encHex] = ciphertext.split(':')
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid ciphertext format')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
