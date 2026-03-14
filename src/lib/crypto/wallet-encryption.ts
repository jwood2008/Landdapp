import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

/**
 * AES-256-GCM envelope encryption for XRPL wallet seeds.
 *
 * Architecture:
 * - Master key: 32-byte hex string from WALLET_ENCRYPTION_KEY env var
 * - Each seed gets a unique 12-byte IV (nonce)
 * - Output format: base64(iv + ciphertext + authTag)
 * - Auth tag: 16 bytes, ensures tamper detection
 *
 * To migrate to GCP/AWS KMS later:
 * 1. Add a new encrypt/decrypt implementation using the KMS SDK
 * 2. Set encryption_method = 'gcp-kms' or 'aws-kms' on new rows
 * 3. Old rows with 'aes-256-gcm-env' continue to work with this code
 * 4. Batch-migrate old rows by decrypting with env key, re-encrypting with KMS
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // GCM recommended nonce size
const TAG_LENGTH = 16 // GCM auth tag size

function getMasterKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'WALLET_ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (hex.length !== 64) {
    throw new Error('WALLET_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a wallet seed. Returns a base64 string safe for DB storage.
 */
export function encryptSeed(plaintext: string): string {
  const key = getMasterKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Pack: iv (12) + ciphertext (variable) + authTag (16)
  const packed = Buffer.concat([iv, encrypted, authTag])
  return packed.toString('base64')
}

/**
 * Decrypt a wallet seed from the base64 blob stored in the DB.
 */
export function decryptSeed(encoded: string): string {
  const key = getMasterKey()
  const packed = Buffer.from(encoded, 'base64')

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted seed: too short')
  }

  const iv = packed.subarray(0, IV_LENGTH)
  const authTag = packed.subarray(packed.length - TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Verify the encryption key is configured and working.
 * Call this at startup or in health checks.
 */
export function verifyEncryptionKey(): boolean {
  try {
    const test = 'encryption-key-test'
    const encrypted = encryptSeed(test)
    const decrypted = decryptSeed(encrypted)
    return decrypted === test
  } catch {
    return false
  }
}
