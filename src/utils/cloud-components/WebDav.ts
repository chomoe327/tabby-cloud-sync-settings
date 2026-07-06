// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
import { AuthType, createClient } from 'webdav'
import CloudSyncSettingsData from '../../data/setting-items'
import SettingsHelper, { SyncOptions } from '../settings-helper'
import { ConfigService, PlatformService } from 'terminus-core'
import * as yaml from 'js-yaml'
import { ToastrService } from 'ngx-toastr'
import CloudSyncLang from '../../data/lang'
import Logger from '../../utils/Logger'
import { joinCloudPath } from '../cloud-path'

let isSyncingInProgress = false
class WebDav {
    async sync(config: ConfigService, platform: PlatformService, toast: ToastrService, params, firstInit = false, _emitter = null, syncOptions: SyncOptions = {}) {
        const logger = new Logger(platform)
        const result = { result: false, message: '' }
        const client = WebDav.createClient(params)
        const remoteFile = joinCloudPath(params.location, CloudSyncSettingsData.cloudSettingsFilename)
        let isAbleToLoadRemoteContent = false
        const options = SettingsHelper.getSyncOptions(platform, syncOptions)

        try {
            await client.stat(remoteFile).then(async (fileStats: any) => {
                isAbleToLoadRemoteContent = true
                let remoteSyncConfigUpdatedAt = null
                if (fileStats?.lastmod) {
                    remoteSyncConfigUpdatedAt = new Date(fileStats.lastmod)
                }

                await client.getFileContents(remoteFile, { format: 'text' }).then(async (content: string) => {
                    try {
                        yaml.load(content)
                        if (firstInit) {
                            if ((await platform.showMessageBox({
                                type: 'warning',
                                message: CloudSyncLang.trans('sync.sync_confirmation'),
                                buttons: [CloudSyncLang.trans('buttons.sync_from_cloud'), CloudSyncLang.trans('buttons.sync_from_local')],
                                defaultId: 0,
                            })).response === 1) {
                                await this.syncLocalSettingsToCloud(platform, toast, options)
                                result['result'] = true
                            } else {
                                if (SettingsHelper.verifyServerConfigIsValid(content)) {
                                    await SettingsHelper.backupTabbyConfigFile(platform)
                                    const decryptedContent = SettingsHelper.doDescryption(content)
                                    const merged = await SettingsHelper.applyConfigFromCloud(config, platform, decryptedContent, options)
                                    SettingsHelper.saveLastSyncedHash(platform, await SettingsHelper.calculateSyncHash(merged, options))
                                    result['result'] = true
                                } else {
                                    result['result'] = false
                                    result['message'] = CloudSyncLang.trans('common.errors.invalidServerConfig')
                                }
                            }
                        } else {
                            logger.log('Auto Sync WebDav (Hash-based)')
                            logger.log('Remote file: ' + remoteFile)

                            const localRaw = SettingsHelper.getLocalConfigRaw(undefined, platform)
                            const remoteDecrypted = SettingsHelper.doDescryption(content)

                            const localHash = await SettingsHelper.calculateSyncHash(localRaw, options)
                            const remoteHash = await SettingsHelper.calculateSyncHash(remoteDecrypted, options)
                            const lastSyncedHash = SettingsHelper.readLastSyncedHash(platform)

                            logger.log('Local Hash: ' + localHash)
                            logger.log('Remote Hash: ' + remoteHash)
                            logger.log('Last Synced Hash: ' + (lastSyncedHash || 'null'))

                            if (localHash === remoteHash) {
                                logger.log('Hashes match. No sync needed.')
                                if (lastSyncedHash === null) {
                                    SettingsHelper.saveLastSyncedHash(platform, localHash)
                                }
                            } else if (lastSyncedHash === null) {
                                logger.log('No last synced hash found. Fallback to timestamp comparison.')
                                const fs = require('fs')
                                const path = require('path')
                                const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.tabbySettingsFilename
                                let localFileUpdatedAt = null
                                try {
                                    const stats = fs.statSync(filePath)
                                    localFileUpdatedAt = new Date(stats.mtime)
                                    logger.log('Server Updated At: ' + (remoteSyncConfigUpdatedAt ? remoteSyncConfigUpdatedAt.toLocaleString() : 'null'))
                                    logger.log('Local Updated At: ' + localFileUpdatedAt.toLocaleString())

                                    if (remoteSyncConfigUpdatedAt && remoteSyncConfigUpdatedAt > localFileUpdatedAt) {
                                        logger.log('Sync direction: Cloud to Local (remote is newer).')
                                        const merged = await SettingsHelper.applyConfigFromCloud(config, platform, remoteDecrypted, options)
                                        SettingsHelper.saveLastSyncedHash(platform, await SettingsHelper.calculateSyncHash(merged, options))
                                    } else {
                                        logger.log('Sync direction: Local to Cloud (local is newer or remote time unknown).')
                                        await this.syncLocalSettingsToCloud(platform, toast, options)
                                    }
                                } catch (statErr) {
                                    logger.log('Error reading local file stat, defaulting to upload local: ' + statErr.toString(), 'error')
                                    await this.syncLocalSettingsToCloud(platform, toast, options)
                                }
                            } else if (localHash !== lastSyncedHash && remoteHash === lastSyncedHash) {
                                logger.log('Sync direction: Local to Cloud (local changed).')
                                await this.syncLocalSettingsToCloud(platform, toast, options)
                            } else if (remoteHash !== lastSyncedHash && localHash === lastSyncedHash) {
                                logger.log('Sync direction: Cloud to Local (remote changed).')
                                const merged = await SettingsHelper.applyConfigFromCloud(config, platform, remoteDecrypted, options)
                                SettingsHelper.saveLastSyncedHash(platform, await SettingsHelper.calculateSyncHash(merged, options))
                            } else {
                                logger.log('Conflict detected! Both local and remote changed.')
                                const now = new Date()
                                const timestamp = now.getFullYear() + '-' +
                                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                                    String(now.getDate()).padStart(2, '0') + '_' +
                                    String(now.getHours()).padStart(2, '0') + '-' +
                                    String(now.getMinutes()).padStart(2, '0') + '-' +
                                    String(now.getSeconds()).padStart(2, '0')
                                const backupFile = remoteFile + '_backup_' + timestamp
                                logger.log('Backing up remote file to: ' + backupFile)
                                try {
                                    await client.copyFile(remoteFile, backupFile)
                                } catch (copyErr) {
                                    logger.log('Failed to backup remote file: ' + copyErr.toString(), 'error')
                                }
                                await this.syncLocalSettingsToCloud(platform, toast, options)
                            }
                            result['result'] = true
                        }
                    } catch (e) {
                        result['result'] = false
                        result['message'] = e.toString()
                        toast.error(CloudSyncLang.trans('sync.error_invalid_setting'))
                        await client.moveFile(remoteFile, remoteFile + '_bk' + new Date().getTime())
                        await this.syncLocalSettingsToCloud(platform, toast, options)
                        logger.log(CloudSyncLang.trans('log.read_cloud_settings') + ' | Exception: ' + e.toString(), 'error')
                    }
                })
            })
        } catch (e) {
            logger.log(CloudSyncLang.trans('log.read_cloud_settings') + ' | Remote file: ' + remoteFile + ' | Exception: ' + e.toString())
            if (!firstInit) {
                logger.log('Auto sync: remote file unreachable, will retry next cycle.')
                return result
            }
            try {
                await this.syncLocalSettingsToCloud(platform, toast, options)
                isAbleToLoadRemoteContent = true
                result['result'] = true
                logger.log('Local config uploaded to cloud successfully after stat failure.')
            } catch (exception) {
                logger.log(CloudSyncLang.trans('log.error_upload_settings') + ' | Exception: ' + exception.toString(), 'error')
            }
        }

        if (!isAbleToLoadRemoteContent) {
            if (firstInit) {
                if ((await platform.showMessageBox({
                    type: 'warning',
                    message: 'Seem to be server has no file or the setting file is corrupted. Do you want to push local file to the cloud?',
                    buttons: ['Cancel', 'Yes'],
                    defaultId: 0,
                })).response === 1) {
                    await this.syncLocalSettingsToCloud(platform, toast, options)
                    result['result'] = true
                }
            } else {
                logger.log('Auto sync: unable to load remote content, will retry next cycle.')
            }
        }
        return result
    }

    async syncLocalSettingsToCloud(platform: PlatformService, toast: ToastrService, syncOptions: SyncOptions = {}) {
        const logger = new Logger(platform)
        if (!isSyncingInProgress) {
            isSyncingInProgress = true

            const savedConfigs = SettingsHelper.readConfigFile(platform)
            const params = savedConfigs.configs
            const remoteFile = joinCloudPath(params.location, CloudSyncSettingsData.cloudSettingsFilename)
            const client = WebDav.createClient(params)
            const options = SettingsHelper.getSyncOptions(platform, syncOptions)

            try {
                let remoteDecrypted: string | null = null
                try {
                    const remoteContent = await client.getFileContents(remoteFile, { format: 'text' }) as string
                    if (SettingsHelper.verifyServerConfigIsValid(remoteContent)) {
                        remoteDecrypted = SettingsHelper.doDescryption(remoteContent)
                    }
                } catch (e) {
                    logger.log('Remote file not found for merge upload, using local-only payload.')
                }

                const uploadPayload = await SettingsHelper.prepareConfigForUpload(platform, remoteDecrypted, options)
                await client.putFileContents(remoteFile, uploadPayload, { overwrite: true }).then(() => {
                    logger.log(CloudSyncLang.trans('sync.sync_success'))
                })
                const localRaw = SettingsHelper.getLocalConfigRaw(undefined, platform)
                SettingsHelper.saveLastSyncedHash(platform, await SettingsHelper.calculateSyncHash(localRaw, options))
                return true
            } catch (e) {
                logger.log(CloudSyncLang.trans('log.error_upload_settings') + ' | Exception: ' + e.toString(), 'error')
                toast.error(CloudSyncLang.trans('sync.sync_error'))
            } finally {
                isSyncingInProgress = false
            }
        } else {
            logger.log('Sync to cloud skipped: another sync is already in progress.')
        }

        return false
    }

    private static createClient(params) {
        return createClient(params.host + (params.port ? ':' + params.port : ''), {
            authType: AuthType.Password,
            username: params.username,
            password: params.password,
        })
    }
}
export default new WebDav()
