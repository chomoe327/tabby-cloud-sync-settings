import { SyncOptions } from './config-merge'
import CloudSyncLang from '../data/lang'
import {
    LogicalConfig,
    PassphraseProvider,
    buildLogicalSyncPayload,
    fromLogicalConfig,
    mergeLogicalConfigs,
    packExpandedYamlForTabby,
    packPlainYamlForSync,
    toLogicalConfig,
} from './config-logical'

export interface SyncContext {
    getPassphrase: PassphraseProvider
}

export async function mergeForDownloadLogicalAsync (
    localRaw: string,
    remoteRaw: string,
    options: SyncOptions,
    context: SyncContext,
): Promise<LogicalConfig> {
    const local = await toLogicalConfig(localRaw, context.getPassphrase, options)
    const remote = await toLogicalConfig(remoteRaw, context.getPassphrase, options)
    const merged = mergeLogicalConfigs(local, remote, options, 'download')

    const remoteKeyCount = Object.keys(remote.data).length
    const localKeyCount = Object.keys(local.data).length
    const mergedKeyCount = Object.keys(merged.data).length

    if (mergedKeyCount === 0) {
        throw new Error(CloudSyncLang.trans('sync.empty_merge_rejected')
            + ` (local keys: ${localKeyCount}, remote keys: ${remoteKeyCount})`)
    }

    return {
        ...merged,
        encrypted: local.encrypted,
    }
}

export async function mergeForDownloadAsync (
    localRaw: string,
    remoteRaw: string,
    options: SyncOptions,
    context: SyncContext,
): Promise<string> {
    const merged = await mergeForDownloadLogicalAsync(localRaw, remoteRaw, options, context)

    if (merged.encrypted) {
        return packExpandedYamlForTabby(merged)
    }

    return packPlainYamlForSync(merged, context.getPassphrase, options)
}

export async function mergeForUploadAsync (
    localRaw: string,
    remoteRaw: string | null,
    options: SyncOptions,
    context: SyncContext,
): Promise<string> {
    const local = await toLogicalConfig(localRaw, context.getPassphrase, options)
    const remote = remoteRaw
        ? await toLogicalConfig(remoteRaw, context.getPassphrase, options)
        : { data: {}, secrets: [], encrypted: false }

    const merged = mergeLogicalConfigs(local, remote, options, 'upload')
    const outputEncrypted = remote.encrypted || local.encrypted
    return fromLogicalConfig(merged, context.getPassphrase, options, outputEncrypted)
}

export async function buildCanonicalSyncPayloadAsync (
    rawYaml: string,
    options: SyncOptions,
    context: SyncContext,
): Promise<string> {
    const logical = await toLogicalConfig(rawYaml, context.getPassphrase, options)
    return buildLogicalSyncPayload(logical, options)
}
