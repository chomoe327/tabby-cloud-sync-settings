import * as yaml from 'js-yaml'
import { SyncOptions } from './config-merge'
import {
    PassphraseProvider,
    buildLogicalSyncPayload,
    fromLogicalConfig,
    mergeLogicalConfigs,
    toLogicalConfig,
} from './config-logical'

export interface SyncContext {
    getPassphrase: PassphraseProvider
}

export async function mergeForDownloadAsync (
    localRaw: string,
    remoteRaw: string,
    options: SyncOptions,
    context: SyncContext,
): Promise<string> {
    if (options.syncMode === 'full') {
        return remoteRaw
    }

    const local = await toLogicalConfig(localRaw, context.getPassphrase, options)
    const remote = await toLogicalConfig(remoteRaw, context.getPassphrase, options)
    const merged = mergeLogicalConfigs(local, remote, options, 'download')

    if (local.encrypted) {
        return yaml.dump({ ...merged.data, encrypted: true }, { lineWidth: -1, noRefs: true })
    }

    return fromLogicalConfig({ ...merged, encrypted: false }, context.getPassphrase, options, false)
}

export async function mergeForUploadAsync (
    localRaw: string,
    remoteRaw: string | null,
    options: SyncOptions,
    context: SyncContext,
): Promise<string> {
    if (options.syncMode === 'full') {
        return localRaw
    }

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
    if (options.syncMode === 'full') {
        return rawYaml
    }

    const logical = await toLogicalConfig(rawYaml, context.getPassphrase, options)
    return buildLogicalSyncPayload(logical, options)
}
