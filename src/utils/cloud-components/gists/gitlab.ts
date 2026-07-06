// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
import { ConfigService, PlatformService } from 'terminus-core'
import Logger from '../../Logger'
import axios from 'axios'
import CloudSyncLang from '../../../data/lang'
import Gist from '../gist'
import CloudSyncSettingsData from '../../../data/setting-items'
import { ToastrService } from 'ngx-toastr'
import { GistParams } from '../../../interface'
import SettingsHelper, { SyncOptions } from '../../settings-helper'
import moment from 'moment'
import path from 'path'
const fs = require('fs')

let isSyncingInProgress = false
class Gitlab extends Gist {
    constructor (id: string, accessToken: string) {
        super(CloudSyncSettingsData.gistUrls.gitlab, id, accessToken)
    }

    testConnection = async (platform: PlatformService): Promise<any> => {
        const logger = new Logger(platform)
        if (!this.id) {
            const createGist = await axios.post(this.baseRequestUrl, {
                title: 'Tabby sync configs',
                files: [{
                    file_path: 'tabby-sync-settings.txt',
                    content: this.getDummyContent(),
                }],
                description: this.getSyncTextDateTime(),
                visibility: 'private',
            }, {
                headers: {
                    'PRIVATE-TOKEN': `${this.accessToken}`,
                },
            }).then((data) => {
                return { code: 1, data: data.data }
            }).catch((e) => {
                return { code: 0, message: e.toString() }
            })

            if (!createGist.code) {
                logger.log(CloudSyncLang.trans('log.error_test_connection') + ' | Exception: ' + CloudSyncLang.trans('gist.error_create_gist'), 'error')
                return { code: 0, message: createGist['message'] }
            }
            this.id = createGist['data'].id
        }
        const url = `${this.baseRequestUrl}/${this.id}`

        return axios.get(url, {
            headers: {
                'PRIVATE-TOKEN': `${this.accessToken}`,
            } }).then(data => {
            return { code: 1, data: data.data }
        }).catch(async e => {
            logger.log(CloudSyncLang.trans('log.error_test_connection') + ' | Exception: ' + e.toString(), 'error')
            return { code: 0, message: e.toString() }
        })
    }

    sync = async (config: ConfigService, platform: PlatformService, toast: ToastrService, params: GistParams, firstInit = false, _emitter = null, syncOptions: SyncOptions = {}): Promise<any> => {
        const logger = new Logger(platform)
        const result = { result: false, message: '' }
        const options = SettingsHelper.getSyncOptions(platform, syncOptions)

        const url = `${this.baseRequestUrl}/${params.id}/raw`
        let remoteSyncConfigUpdatedAt = null

        await axios.get(`${this.baseRequestUrl}/${params.id}`, {
            headers: {
                'PRIVATE-TOKEN': `${params.accessToken}`,
            } }).then(data => {
            if (data.data?.updated_at) {
                remoteSyncConfigUpdatedAt = moment(data.data.updated_at)
            }
        }).catch(e => {
            logger.log(CloudSyncLang.trans('log.error_test_connection') + ' | Exception: ' + e.toString(), 'error')
            return { code: 0, message: e.toString(), data: null }
        })

        const gistContent: {
            code: number,
            data: any,
            message: string
        } = await axios.get(url, {
            headers: {
                'PRIVATE-TOKEN': `${params.accessToken}`,
            } }).then(data => {
            return { code: 1, data: data.data, message: '' }
        }).catch(e => {
            logger.log(CloudSyncLang.trans('log.error_test_connection') + ' | Exception: ' + e.toString(), 'error')
            return { code: 0, message: e.toString(), data: null }
        })

        if (gistContent.code) {
            const serverTabbyContent = gistContent.data

            if (firstInit) {
                if ((await platform.showMessageBox({
                    type: 'warning',
                    message: CloudSyncLang.trans('sync.sync_confirmation'),
                    buttons: [CloudSyncLang.trans('buttons.sync_from_cloud'), CloudSyncLang.trans('buttons.sync_from_local')],
                    defaultId: 0,
                })).response === 1) {
                    result['result'] = await this.syncLocalSettingsToCloud(platform, toast, options)
                } else {
                    if (SettingsHelper.verifyServerConfigIsValid(serverTabbyContent)) {
                        await SettingsHelper.backupTabbyConfigFile(platform)
                        await SettingsHelper.applyConfigFromCloud(config, platform, SettingsHelper.doDescryption(serverTabbyContent), options)
                        return true
                    } else {
                        result['result'] = false
                        result['message'] = CloudSyncLang.trans('common.errors.invalidServerConfig')
                    }
                }
            } else {
                const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.tabbySettingsFilename
                try {
                    const stats = fs.statSync(filePath)
                    const localFileUpdatedAt = moment(stats.mtime)
                    logger.log('Auto Sync GitLab Gist')
                    logger.log('Server Updated At ' + (remoteSyncConfigUpdatedAt ? remoteSyncConfigUpdatedAt.format('YYYY-MM-DD HH:mm:ss') : null ))
                    logger.log('Local Updated At '+ localFileUpdatedAt.format('YYYY-MM-DD HH:mm:ss'))

                    if (remoteSyncConfigUpdatedAt && remoteSyncConfigUpdatedAt > localFileUpdatedAt) {
                        logger.log('Sync direction: Cloud to local.')
                        await SettingsHelper.applyConfigFromCloud(config, platform, SettingsHelper.doDescryption(serverTabbyContent), options)
                    } else {
                        logger.log('Sync direction: Local To Cloud.')
                        await this.syncLocalSettingsToCloud(platform, toast, options)
                    }
                } catch (err) {
                    logger.log(err)
                }
                return true
            }
        } else {
            result['message'] = gistContent.message
        }

        return result
    }

    async syncLocalSettingsToCloud (platform: PlatformService, toast: ToastrService, syncOptions: SyncOptions = {}): Promise<any> {
        const logger = new Logger(platform)
        let result = false
        if (!isSyncingInProgress) {
            isSyncingInProgress = true

            const savedConfigs = SettingsHelper.readConfigFile(platform)
            const params = savedConfigs.configs as GistParams
            const options = SettingsHelper.getSyncOptions(platform, syncOptions)
            let remoteDecrypted: string | null = null
            const component = new Gitlab(params.id, params.accessToken)

            try {
                const url = `${this.baseRequestUrl}/${params.id}/raw`
                const gistContent = await axios.get(url, {
                    headers: {
                        'PRIVATE-TOKEN': `${params.accessToken}`,
                    },
                })
                if (SettingsHelper.verifyServerConfigIsValid(gistContent.data)) {
                    remoteDecrypted = SettingsHelper.doDescryption(gistContent.data)
                }
            } catch (e) {
                logger.log('Remote GitLab snippet not found for merge upload.')
            }

            const localSettingContent = await SettingsHelper.prepareConfigForUpload(platform, remoteDecrypted, options)

            result = await axios.put(`${component.baseRequestUrl}/${component.id}`, {
                gist_id: component.id,
                files: [{
                    file_path: 'tabby-sync-settings.txt',
                    content: localSettingContent,
                    action: 'update',
                }],
                description: this.getSyncTextDateTime(),
            }, {
                headers: {
                    'PRIVATE-TOKEN': `${component.accessToken}`,
                },
            }).then(() => {
                logger.log(CloudSyncLang.trans('sync.sync_success'))
                return true
            }).catch(e => {
                logger.log(CloudSyncLang.trans('log.error_upload_settings') + ' | Exception: ' + e.toString(), 'error')
                if (isSyncingInProgress) {
                    toast.error(CloudSyncLang.trans('sync.sync_error'))
                }
                return false
            })


            isSyncingInProgress = false
        }

        return result
    }
}

export default Gitlab
