import crypto from "node:crypto"

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const stepSeconds = 30
const digits = 6

function getEncryptionKey() {
  const rawKey = process.env.TOTP_ENCRYPTION_KEY
  if (!rawKey) {
    throw new Error("TOTP_ENCRYPTION_KEY is required before enabling two-factor authentication.")
  }

  const key = Buffer.from(rawKey, "base64")
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must be a 32-byte base64 value.")
  }

  return key
}

export function generateTotpSecret() {
  const bytes = crypto.randomBytes(20)
  let bits = ""
  let secret = ""

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0")
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0")
    secret += base32Alphabet[Number.parseInt(chunk, 2)]
  }

  return secret
}

function decodeBase32(secret: string) {
  const normalized = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase()
  let bits = ""

  for (const char of normalized) {
    const value = base32Alphabet.indexOf(char)
    if (value < 0) throw new Error("Invalid authenticator secret.")
    bits += value.toString(2).padStart(5, "0")
  }

  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }

  return Buffer.from(bytes)
}

function hotp(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  counterBuffer.writeUInt32BE(counter >>> 0, 4)

  const hmac = crypto.createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(binary % 10 ** digits).padStart(digits, "0")
}

export function verifyTotpCode(secret: string, code: string, now = Date.now()) {
  const normalizedCode = code.trim()
  if (!/^\d{6}$/.test(normalizedCode)) return false

  const currentCounter = Math.floor(now / 1000 / stepSeconds)
  for (const drift of [-1, 0, 1]) {
    if (hotp(secret, currentCounter + drift) === normalizedCode) return true
  }

  return false
}

export function encryptText(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".")
}

export function decryptText(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".")
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Encrypted payload is invalid.")

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64"))
  decipher.setAuthTag(Buffer.from(tagValue, "base64"))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

export function buildOtpAuthUri(input: { issuer: string; account: string; secret: string }) {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`)
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(stepSeconds),
  })

  return `otpauth://totp/${label}?${params.toString()}`
}
