import * as crypto from 'crypto'
import { promisify } from 'util'

const PBKDF_ITERATIONS = 100000
const PBKDF_DIGEST = 'sha512'
const PBKDF_SALT_LENGTH = 64 / 8
const CRYPT_ALG = 'aes-256-cbc'
const CRYPT_KEY_LENGTH = 256 / 8
const CRYPT_IV_LENGTH = 128 / 8

export interface StoredVault {
    version: number
    contents: string
    keySalt: string
    iv: string
}

export interface VaultSecret {
    type: string
    key: Record<string, unknown>
    value: string
}

export interface VaultContent {
    config: Record<string, unknown>
    secrets: VaultSecret[]
}

function deriveVaultKey (passphrase: string, salt: Buffer): Promise<Buffer> {
    return promisify(crypto.pbkdf2)(
        Buffer.from(passphrase),
        salt,
        PBKDF_ITERATIONS,
        CRYPT_KEY_LENGTH,
        PBKDF_DIGEST,
    )
}

function migrateVaultContent (content: Record<string, unknown>): VaultContent {
    return {
        config: (content.config as Record<string, unknown>) ?? {},
        secrets: (content.secrets as VaultSecret[]) ?? [],
    }
}

export async function decryptVault (vault: StoredVault, passphrase: string): Promise<VaultContent> {
    if (vault.version !== 1) {
        throw new Error(`Unsupported vault format version ${vault.version}`)
    }
    const keySalt = Buffer.from(vault.keySalt, 'hex')
    const key = await deriveVaultKey(passphrase, keySalt)
    const iv = Buffer.from(vault.iv, 'hex')
    const encrypted = Buffer.from(vault.contents, 'base64')

    const decipher = crypto.createDecipheriv(CRYPT_ALG, key, iv)
    const plaintext = decipher.update(encrypted, undefined, 'utf-8') + decipher.final('utf-8')
    return migrateVaultContent(JSON.parse(plaintext) as Record<string, unknown>)
}

export async function encryptVault (content: VaultContent, passphrase: string): Promise<StoredVault> {
    const keySalt = await promisify(crypto.randomBytes)(PBKDF_SALT_LENGTH)
    const iv = await promisify(crypto.randomBytes)(CRYPT_IV_LENGTH)
    const key = await deriveVaultKey(passphrase, keySalt)

    const plaintext = JSON.stringify(content)
    const cipher = crypto.createCipheriv(CRYPT_ALG, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])

    return {
        version: 1,
        contents: encrypted.toString('base64'),
        keySalt: keySalt.toString('hex'),
        iv: iv.toString('hex'),
    }
}

export function isStoredVault (value: unknown): value is StoredVault {
    if (!value || typeof value !== 'object') {
        return false
    }
    const vault = value as StoredVault
    return typeof vault.version === 'number'
        && typeof vault.contents === 'string'
        && typeof vault.keySalt === 'string'
        && typeof vault.iv === 'string'
}
