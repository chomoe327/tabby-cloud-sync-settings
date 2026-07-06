import * as yaml from 'js-yaml'
import {
    SyncOptions,
    applyFieldsFromSource,
    buildCanonicalPayloadFromData,
    isEncryptedConfig,
    parseConfigYaml,
} from './config-merge'
import { decryptVault, encryptVault, isStoredVault, VaultContent, VaultSecret } from './vault-crypto'

export type PassphraseProvider = () => Promise<string>

export interface LogicalConfig {
    data: Record<string, any>
    secrets: VaultSecret[]
    encrypted: boolean
    configSync?: Record<string, unknown>
}

function stripStorageKeys (data: Record<string, any>): Record<string, any> {
    const logical = { ...data }
    delete logical.vault
    delete logical.encrypted
    delete logical.configSync
    return logical
}

async function decryptVaultBlob (
    vaultBlob: unknown,
    getPassphrase: PassphraseProvider,
): Promise<VaultContent> {
    if (!isStoredVault(vaultBlob)) {
        throw new Error('Invalid vault data')
    }
    const passphrase = await getPassphrase()
    return decryptVault(vaultBlob, passphrase)
}

export async function toLogicalConfig (
    rawYaml: string,
    getPassphrase: PassphraseProvider,
    options: SyncOptions = {},
): Promise<LogicalConfig> {
    const store = parseConfigYaml(rawYaml)
    const configSync = store.configSync
    const storageOnlyKeys = new Set(['vault', 'encrypted', 'configSync'])
    const hasExpandedConfig = Object.keys(store).some(key => !storageOnlyKeys.has(key))

    if (isEncryptedConfig(store) && store.vault && hasExpandedConfig) {
        let secrets: VaultSecret[] = []
        if (options.syncVault) {
            try {
                const vault = await decryptVaultBlob(store.vault, getPassphrase)
                secrets = vault.secrets ?? []
            } catch {
                secrets = []
            }
        }
        return {
            data: stripStorageKeys({ ...store }),
            secrets,
            encrypted: true,
            configSync,
        }
    }

    let secrets: VaultSecret[] = []

    if (isEncryptedConfig(store) && store.vault) {
        const vault = await decryptVaultBlob(store.vault, getPassphrase)
        secrets = vault.secrets ?? []
        return {
            data: stripStorageKeys({ ...vault.config }),
            secrets,
            encrypted: true,
            configSync,
        }
    }

    const logical = stripStorageKeys({ ...store })
    if (options.syncVault && store.vault) {
        try {
            const vault = await decryptVaultBlob(store.vault, getPassphrase)
            secrets = vault.secrets ?? []
        } catch {
            secrets = []
        }
    }

    return {
        data: logical,
        secrets,
        encrypted: false,
        configSync,
    }
}

async function packEncryptedYaml (
    logical: LogicalConfig,
    getPassphrase: PassphraseProvider,
    options: SyncOptions,
): Promise<string> {
    const passphrase = await getPassphrase()
    const vaultContent: VaultContent = {
        config: { ...logical.data },
        secrets: options.syncVault ? logical.secrets : [],
    }
    const store: Record<string, unknown> = {
        vault: await encryptVault(vaultContent, passphrase),
        encrypted: true,
    }
    if (logical.configSync !== undefined) {
        store.configSync = logical.configSync
    }
    return yaml.dump(store, { lineWidth: -1, noRefs: true })
}

async function packPlainYaml (
    logical: LogicalConfig,
    getPassphrase: PassphraseProvider,
    options: SyncOptions,
): Promise<string> {
    const store: Record<string, unknown> = { ...logical.data }
    if (options.syncVault && logical.secrets.length > 0) {
        const passphrase = await getPassphrase()
        store.vault = await encryptVault({
            config: {},
            secrets: logical.secrets,
        }, passphrase)
    }
    return yaml.dump(store, { lineWidth: -1, noRefs: true })
}

export async function fromLogicalConfig (
    logical: LogicalConfig,
    getPassphrase: PassphraseProvider,
    options: SyncOptions,
    outputEncrypted?: boolean,
): Promise<string> {
    const encrypted = outputEncrypted ?? logical.encrypted
    if (encrypted) {
        return packEncryptedYaml(logical, getPassphrase, options)
    }
    return packPlainYaml(logical, getPassphrase, options)
}

function mergeSecrets (local: VaultSecret[], remote: VaultSecret[]): VaultSecret[] {
    if (!remote.length) {
        return local
    }
    const merged = [...local]
    for (const secret of remote) {
        const index = merged.findIndex(item => item.type === secret.type
            && JSON.stringify(item.key) === JSON.stringify(secret.key))
        if (index >= 0) {
            merged[index] = secret
        } else {
            merged.push(secret)
        }
    }
    return merged
}

export function mergeLogicalConfigs (
    local: LogicalConfig,
    remote: LogicalConfig,
    options: SyncOptions,
    direction: 'download' | 'upload',
): LogicalConfig {
    const base = direction === 'download' ? { ...local } : { ...remote }
    const source = direction === 'download' ? remote : local

    let mergedData: Record<string, any>
    if (options.syncMode === 'full') {
        mergedData = { ...base.data, ...source.data }
    } else {
        mergedData = { ...base.data }
        applyFieldsFromSource(mergedData, source.data, options)
    }

    let mergedSecrets = base.secrets
    if (options.syncVault) {
        mergedSecrets = direction === 'download'
            ? mergeSecrets(local.secrets, remote.secrets)
            : mergeSecrets(remote.secrets, local.secrets)
    }

    return {
        data: mergedData,
        secrets: mergedSecrets,
        encrypted: base.encrypted,
        configSync: base.configSync ?? source.configSync,
    }
}

export function buildLogicalSyncPayload (logical: LogicalConfig, options: SyncOptions): string {
    return buildCanonicalPayloadFromData(logical.data, options, logical.secrets)
}
