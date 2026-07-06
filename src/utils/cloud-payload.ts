import { SyncMode } from './config-merge'

export const CLOUD_FORMAT_VERSION = 1

export interface CloudSyncMeta {
    formatVersion: number
    pluginVersion: string
    lastUploadMode: SyncMode
    lastUploadAt: string
    syncVault?: boolean
}

export interface CloudStorageEnvelope {
    _meta: CloudSyncMeta
    configYaml: string
}

export function wrapCloudEnvelope (
    configYaml: string,
    syncMode: SyncMode,
    pluginVersion: string,
    syncVault?: boolean,
): string {
    const envelope: CloudStorageEnvelope = {
        _meta: {
            formatVersion: CLOUD_FORMAT_VERSION,
            pluginVersion,
            lastUploadMode: syncMode,
            lastUploadAt: new Date().toISOString(),
            syncVault,
        },
        configYaml,
    }
    return JSON.stringify(envelope)
}

export function unwrapCloudEnvelope (decrypted: string): { configYaml: string, meta: CloudSyncMeta | null } {
    const trimmed = decrypted.trim()
    if (!trimmed) {
        return { configYaml: '', meta: null }
    }
    if (!trimmed.startsWith('{')) {
        return { configYaml: decrypted, meta: null }
    }

    try {
        const parsed = JSON.parse(trimmed) as Partial<CloudStorageEnvelope>
        if (typeof parsed.configYaml === 'string') {
            const inner = parsed.configYaml.trim()
            if (inner.startsWith('{') && inner.includes('"configYaml"')) {
                return unwrapCloudEnvelope(parsed.configYaml)
            }
            return { configYaml: parsed.configYaml, meta: (parsed._meta as CloudSyncMeta) ?? null }
        }
    } catch {
        // fall through to legacy yaml
    }

    return { configYaml: decrypted, meta: null }
}
