// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
import { AuthType, createClient } from 'webdav'
import CloudSyncSettingsData from '../../data/setting-items'
import SettingsHelper from '../settings-helper'
import { ConfigService, PlatformService } from 'terminus-core'
import * as yaml from 'js-yaml'
import { ToastrService } from 'ngx-toastr'
import CloudSyncLang from '../../data/lang'
import Logger from '../../utils/Logger'

let isSyncingInProgress = false
class WebDav {
    async sync(config: ConfigService, platform: PlatformService, toast: ToastrService, params, firstInit = false) {
        const logger = new Logger(platform)
        const result = { result: false, message: '' }
        const client = WebDav.createClient(params)
        const remoteFile = params.location + CloudSyncSettingsData.cloudSettingsFilename
        let isAbleToLoadRemoteContent = false

        try {
            await client.stat(remoteFile).then(async (fileStats: any) => {
                isAbleToLoadRemoteContent = true
                let remoteSyncConfigUpdatedAt = null
                if (fileStats?.lastmod) {
                    // fileStats.lastmod is a string (e.g. from WedDav stat)
                    remoteSyncConfigUpdatedAt = new Date(fileStats.lastmod)
                }

                await client.getFileContents(remoteFile, { format: 'text' }).then(async (content: string) => {
                    try {
                        yaml.load(content)
                        if (firstInit) {
                            // 首次初始化：弹窗让用户选择同步方向
                            if ((await platform.showMessageBox({
                                type: 'warning',
                                message: CloudSyncLang.trans('sync.sync_confirmation'),
                                buttons: [CloudSyncLang.trans('buttons.sync_from_cloud'), CloudSyncLang.trans('buttons.sync_from_local')],
                                defaultId: 0,
                            })).response === 1) {
                                // 用户选择上传本地配置到云端
                                const localEncrypted = SettingsHelper.readTabbyConfigFile(platform, true, true)
                                await client.putFileContents(remoteFile, localEncrypted, { overwrite: true })
                                // 首次同步成功，保存当前 hash 作为基准 (save hash baseline after first sync)
                                const localRaw = SettingsHelper.readTabbyConfigFile(platform, true, false)
                                SettingsHelper.saveLastSyncedHash(platform, SettingsHelper.calculateHash(localRaw))
                                result['result'] = true
                            } else {
                                // 用户选择从云端下载配置
                                if (SettingsHelper.verifyServerConfigIsValid(content)) {
                                    await SettingsHelper.backupTabbyConfigFile(platform)
                                    const decryptedContent = SettingsHelper.doDescryption(content)
                                    config.writeRaw(decryptedContent)
                                    // 下载成功，保存 hash 基准（save hash baseline after download）
                                    SettingsHelper.saveLastSyncedHash(platform, SettingsHelper.calculateHash(decryptedContent))
                                    result['result'] = true
                                } else {
                                    result['result'] = false
                                    result['message'] = CloudSyncLang.trans('common.errors.invalidServerConfig')
                                }
                            }
                        } else {
                            // 自动同步：使用 hash 三向对比决定同步方向
                            // Auto sync: use three-way hash comparison to determine sync direction
                            logger.log('Auto Sync WebDav (Hash-based)')
                            logger.log('Remote file: ' + remoteFile)

                            const localRaw = SettingsHelper.readTabbyConfigFile(platform, true, false)
                            const remoteDecrypted = SettingsHelper.doDescryption(content)

                            const localHash = SettingsHelper.calculateHash(localRaw)
                            const remoteHash = SettingsHelper.calculateHash(remoteDecrypted)
                            const lastSyncedHash = SettingsHelper.readLastSyncedHash(platform)

                            logger.log('Local Hash: ' + localHash)
                            logger.log('Remote Hash: ' + remoteHash)
                            logger.log('Last Synced Hash: ' + (lastSyncedHash || 'null'))

                            if (localHash === remoteHash) {
                                // 情况1：本地和云端完全一致，无需同步
                                // Case 1: local and remote are identical, skip sync
                                logger.log('Hashes match. No sync needed.')
                                if (lastSyncedHash === null) {
                                    SettingsHelper.saveLastSyncedHash(platform, localHash)
                                }
                            } else if (lastSyncedHash === null) {
                                // 首次升级到新版本插件（无 lastSyncedHash 记录），使用 mtime 作为过渡判断
                                // First run after plugin update (no lastSyncedHash), fallback to mtime comparison
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
                                        config.writeRaw(remoteDecrypted)
                                        SettingsHelper.saveLastSyncedHash(platform, remoteHash)
                                    } else {
                                        logger.log('Sync direction: Local to Cloud (local is newer or remote time unknown).')
                                        await this.syncLocalSettingsToCloud(platform, toast) // hash will be saved inside
                                    }
                                } catch (statErr) {
                                    logger.log('Error reading local file stat, defaulting to upload local: ' + statErr.toString(), 'error')
                                    await this.syncLocalSettingsToCloud(platform, toast)
                                }
                            } else if (localHash !== lastSyncedHash && remoteHash === lastSyncedHash) {
                                // 情况2：只有本地变化，上传到云端
                                // Case 2: only local changed, upload to cloud
                                logger.log('Sync direction: Local to Cloud (local changed).')
                                await this.syncLocalSettingsToCloud(platform, toast)
                                SettingsHelper.saveLastSyncedHash(platform, localHash)
                            } else if (remoteHash !== lastSyncedHash && localHash === lastSyncedHash) {
                                // 情况3：只有云端变化，下载到本地
                                // Case 3: only remote changed, download to local
                                logger.log('Sync direction: Cloud to Local (remote changed).')
                                config.writeRaw(remoteDecrypted)
                                SettingsHelper.saveLastSyncedHash(platform, remoteHash)
                            } else {
                                // 情况4：双方都变化（冲突），备份云端文件后上传本地配置
                                // Case 4: both changed (conflict), backup remote then upload local
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
                                // 备份完成后上传本地配置覆盖云端
                                // After backup, upload local config to overwrite remote
                                await this.syncLocalSettingsToCloud(platform, toast)
                                SettingsHelper.saveLastSyncedHash(platform, localHash)
                            }
                            result['result'] = true
                        }
                    } catch (e) {
                        result['result'] = false
                        result['message'] = e.toString()
                        toast.error(CloudSyncLang.trans('sync.error_invalid_setting'))
                        await client.moveFile(remoteFile, remoteFile + '_bk' + new Date().getTime())
                        const localEncrypted = SettingsHelper.readTabbyConfigFile(platform, true, true)
                        await client.putFileContents(remoteFile, localEncrypted, { overwrite: true })
                        // 异常恢复后也更新 hash（update hash after error recovery）
                        const localRaw = SettingsHelper.readTabbyConfigFile(platform, true, false)
                        SettingsHelper.saveLastSyncedHash(platform, SettingsHelper.calculateHash(localRaw))
                        logger.log(CloudSyncLang.trans('log.read_cloud_settings') + ' | Exception: ' + e.toString(), 'error')
                    }
                })
            })
        } catch (e) {
            logger.log(CloudSyncLang.trans('log.read_cloud_settings') + ' | Remote file: ' + remoteFile + ' | Exception: ' + e.toString())
            if (!firstInit) {
                // 自动同步时，远程文件不可达则静默跳过，等待下次同步周期重试（auto sync: skip silently, retry next cycle）
                logger.log('Auto sync: remote file unreachable, will retry next cycle.')
                return result
            }
            try {
                const localEncrypted = SettingsHelper.readTabbyConfigFile(platform, true, true)
                await client.putFileContents(remoteFile, localEncrypted, { overwrite: true })
                isAbleToLoadRemoteContent = true
                result['result'] = true
                // 首次上传成功后保存 hash（save hash after first upload）
                const localRaw = SettingsHelper.readTabbyConfigFile(platform, true, false)
                SettingsHelper.saveLastSyncedHash(platform, SettingsHelper.calculateHash(localRaw))
                logger.log('Local config uploaded to cloud successfully after stat failure.')
            } catch (exception) {
                logger.log(CloudSyncLang.trans('log.error_upload_settings') + ' | Exception: ' + exception.toString(), 'error')
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isAbleToLoadRemoteContent) {
            if (firstInit) {
                // 仅首次初始化时弹窗询问用户（only prompt user during first init）
                if ((await platform.showMessageBox({
                    type: 'warning',
                    message: 'Seem to be server has no file or the setting file is corrupted. Do you want to push local file to the cloud?',
                    buttons: ['Cancel', 'Yes'],
                    defaultId: 0,
                })).response === 1) {
                    const localEncrypted = SettingsHelper.readTabbyConfigFile(platform, true, true)
                    await client.putFileContents(remoteFile, localEncrypted, { overwrite: true })
                    // 保存 hash 基准（save hash baseline）
                    const localRaw = SettingsHelper.readTabbyConfigFile(platform, true, false)
                    SettingsHelper.saveLastSyncedHash(platform, SettingsHelper.calculateHash(localRaw))
                    result['result'] = true
                }
            } else {
                // 自动同步时静默跳过，等待下次周期重试（auto sync: skip silently, retry next cycle）
                logger.log('Auto sync: unable to load remote content, will retry next cycle.')
            }
        }
        return result
    }

    async syncLocalSettingsToCloud(platform: PlatformService, toast: ToastrService) {
        const logger = new Logger(platform)
        if (!isSyncingInProgress) {
            isSyncingInProgress = true

            const savedConfigs = SettingsHelper.readConfigFile(platform)
            const params = savedConfigs.configs
            const remoteFile = params.location + CloudSyncSettingsData.cloudSettingsFilename
            const client = WebDav.createClient(params)

            try {
                await client.putFileContents(remoteFile, SettingsHelper.readTabbyConfigFile(platform, true, true), { overwrite: true }).then(() => {
                    logger.log(CloudSyncLang.trans('sync.sync_success'))
                })
                // 上传成功后更新 hash（update hash after successful upload）
                const localRaw = SettingsHelper.readTabbyConfigFile(platform, true, false)
                SettingsHelper.saveLastSyncedHash(platform, SettingsHelper.calculateHash(localRaw))
                return true
            } catch (e) {
                logger.log(CloudSyncLang.trans('log.error_upload_settings') + ' | Exception: ' + e.toString(), 'error')
                toast.error(CloudSyncLang.trans('sync.sync_error'))
            } finally {
                // 确保锁一定被释放，无论成功还是失败 (ensure lock is always released)
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

