// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
import { ConfigService, PlatformService } from 'terminus-core'
import CloudSyncSettingsData from '../data/setting-items'
import { ToastrService } from 'ngx-toastr'
import WebDav from './cloud-components/WebDav'
import CloudSyncLang from '../data/lang'
import AmazonS3 from './cloud-components/AmazonS3'
import FTP from './cloud-components/FTP'
import Gists from './cloud-components/gists/gists'
import DropboxSync from './cloud-components/Dropbox'
import {EventEmitter} from "@angular/core";
import Logger from "./Logger";
import axios from "axios";
import {
    SyncOptions,
    getDefaultSyncFields,
    resolveSyncOptions,
} from './config-merge'
import {
    buildCanonicalSyncPayloadAsync,
    mergeForDownloadAsync,
    mergeForUploadAsync,
    SyncContext,
} from './config-sync'
import { unwrapCloudEnvelope, wrapCloudEnvelope, CloudSyncMeta } from './cloud-payload'
import { getPluginVersion } from './plugin-version'

const fs = require('fs')
const path = require('path')
const CryptoJS = require('crypto-js')

export type { SyncOptions } from './config-merge'

export class SettingsHelperClass {
    private vaultService: { getPassphrase (): Promise<string> } | null = null
    private configService: ConfigService | null = null

    private adapterHandler = {
        [CloudSyncSettingsData.values.WEBDAV]: WebDav,
        [CloudSyncSettingsData.values.S3]: AmazonS3,
        [CloudSyncSettingsData.values.WASABI]: AmazonS3,
        [CloudSyncSettingsData.values.DIGITAL_OCEAN]: AmazonS3,
        [CloudSyncSettingsData.values.BLACKBLAZE]: AmazonS3,
        [CloudSyncSettingsData.values.S3_COMPATIBLE]: AmazonS3,
        [CloudSyncSettingsData.values.FTP]: FTP,
        [CloudSyncSettingsData.values.GIST]: Gists,
        [CloudSyncSettingsData.values.DROPBOX]: DropboxSync,
    }
    private generatedCryptoHash = 'tp!&nc3^to8y7^3#4%2%&szufx!'

    setVaultService (vault: { getPassphrase (): Promise<string> }): void {
        this.vaultService = vault
    }

    setConfigService (config: ConfigService): void {
        this.configService = config
    }

    getSyncOptions (platform: PlatformService, override: SyncOptions = {}): SyncOptions {
        return resolveSyncOptions(this.readConfigFile(platform), override)
    }

    private createSyncContext (): SyncContext {
        return {
            getPassphrase: async () => {
                if (this.vaultService) {
                    return this.vaultService.getPassphrase()
                }
                throw new Error(CloudSyncLang.trans('sync.vault_passphrase_required'))
            },
        }
    }

    getLocalConfigRaw (config?: ConfigService, platform?: PlatformService): string {
        const activeConfig = config ?? this.configService
        if (activeConfig) {
            return activeConfig.readRaw()
        }
        return this.readTabbyConfigFile(platform, true, false) || ''
    }

    encryptConfigContent (content: string): string {
        return CloudSyncLang.trans('common.config_inject_header') + CryptoJS.AES.encrypt(content, this.generatedCryptoHash).toString()
    }

    async prepareConfigForUpload (
        platform: PlatformService,
        remoteDecrypted: string | null,
        options: SyncOptions,
        config?: ConfigService,
    ): Promise<string> {
        const localRaw = this.getLocalConfigRaw(config, platform)
        const mergedYaml = await mergeForUploadAsync(localRaw, remoteDecrypted, options, this.createSyncContext())
        const envelope = wrapCloudEnvelope(
            mergedYaml,
            options.syncMode || 'platform_safe',
            getPluginVersion(),
            options.syncVault,
        )
        return this.encryptConfigContent(envelope)
    }

    async applyConfigFromCloud (
        config: ConfigService,
        platform: PlatformService,
        remoteDecrypted: string,
        options: SyncOptions,
    ): Promise<string> {
        const localRaw = this.getLocalConfigRaw(config, platform)
        const merged = await mergeForDownloadAsync(localRaw, remoteDecrypted, options, this.createSyncContext())
        await config.writeRaw(merged)
        return merged
    }

    async calculateSyncHash (content: string, options: SyncOptions): Promise<string> {
        const payload = await buildCanonicalSyncPayloadAsync(content, options, this.createSyncContext())
        return CryptoJS.SHA256(payload).toString()
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async saveSettingsToFile (platform: PlatformService, adapter: string, params: any): Promise<any> {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename
        const settingsArr = {
            adapter: adapter,
            enabled: true,
            showLoader: true,
            interval_insync: CloudSyncSettingsData.defaultSyncInterval,
            syncMode: 'platform_safe',
            syncFields: getDefaultSyncFields(),
            configs: params,
        }
        if (fs.existsSync(filePath)) {
            const savedConfigs = this.readConfigFile(platform)
            settingsArr.enabled = savedConfigs !== null ? savedConfigs['enabled'] : true
            settingsArr.showLoader = savedConfigs !== null ? savedConfigs['showLoader'] : true
            settingsArr.interval_insync = savedConfigs !== null ? savedConfigs['interval_insync'] : CloudSyncSettingsData.defaultSyncInterval
            settingsArr.syncMode = savedConfigs?.syncMode ?? settingsArr.syncMode
            settingsArr.syncFields = savedConfigs?.syncFields ?? savedConfigs?.syncSections ?? settingsArr.syncFields
        }
        const fileContent = CloudSyncLang.trans('common.config_inject_header') + CryptoJS.AES.encrypt(JSON.stringify(settingsArr), this.generatedCryptoHash).toString()

        try {
            const promise = new Promise((resolve, reject) => {
                return fs.writeFile(filePath, fileContent,
                    (err) => {
                        if (err) {
                            reject(false)
                        }

                        resolve(true)
                    })
            })

            return await promise.then(status => {
                return status
            })
        } catch (e) {
            return false
        }
    }

    async saveSyncSectionSettings (
        platform: PlatformService,
        toast: ToastrService,
        syncMode: string,
        syncFields: Record<string, boolean>,
        syncVault = false,
    ): Promise<boolean> {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename
        if (!fs.existsSync(filePath)) {
            toast.error(CloudSyncLang.trans('sync.need_to_save_config'))
            return false
        }
        const savedConfigs = this.readConfigFile(platform)
        if (!savedConfigs) {
            toast.error(CloudSyncLang.trans('sync.error_save_setting'))
            return false
        }

        savedConfigs.syncMode = syncMode
        savedConfigs.syncFields = syncFields
        savedConfigs.syncVault = syncVault
        delete savedConfigs.syncSections
        const fileContent = CloudSyncLang.trans('common.config_inject_header') + CryptoJS.AES.encrypt(JSON.stringify(savedConfigs), this.generatedCryptoHash).toString()

        try {
            await new Promise((resolve, reject) => {
                fs.writeFile(filePath, fileContent, (err) => {
                    if (err) {
                        reject(false)
                    } else {
                        resolve(true)
                    }
                })
            })
            toast.info(CloudSyncLang.trans('sync.sync_sections_saved'))
            return true
        } catch (e) {
            toast.error(CloudSyncLang.trans('sync.error_save_setting'))
            return false
        }
    }

    async generateEncryptedTabbyFileForUpload (platform: PlatformService, remoteDecrypted: string | null = null, options: SyncOptions = null): Promise<any> {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.tabbyLocalEncryptedFile
        const syncOptions = options ?? this.getSyncOptions(platform)
        try {
            const tabbyConfig = await this.prepareConfigForUpload(platform, remoteDecrypted, syncOptions)
            const promise = new Promise((resolve, reject) => {
                return fs.writeFile(filePath, tabbyConfig,
                    (err) => {
                        if (err) {
                            reject(false)
                        }

                        resolve(true)
                    })
            })

            return await promise.then(status => {
                return status
            })
        } catch (e) {
            return false
        }
    }

    async syncWithCloud (
        config: ConfigService,
        platform: PlatformService,
        toast: ToastrService,
        firstInit = false,
        emitter: EventEmitter<any> = null,
        syncOptions: SyncOptions = {},
    ): Promise<any> {
        const savedConfigs = this.readConfigFile(platform)
        let result = false
        const logger = new Logger(platform)
        const options = this.getSyncOptions(platform, syncOptions)

        if (!savedConfigs?.enabled && !options.ignoreEnabled) {
            logger.log('Sync disabled. Skipping...')
            return false
        }

        if (savedConfigs?.enabled || options.ignoreEnabled) {
            if (CloudSyncSettingsData.isCloudStorageS3Compatibility(savedConfigs.adapter)) {
                AmazonS3.setProvider(savedConfigs.adapter)
            }

            try {
                await this.adapterHandler[savedConfigs.adapter].sync(config, platform, toast, savedConfigs.configs, firstInit, emitter, options).then(status => {
                    result = status
                })
            } catch (e) {
                toast.error(e.toString())
            }
        }

        return result
    }

    async syncWithCloudSettings (platform: PlatformService, toast: ToastrService, syncOptions: SyncOptions = {}): Promise<void> {
        const savedConfigs = this.readConfigFile(platform)
        if (savedConfigs) {
            await this.adapterHandler[savedConfigs.adapter].syncLocalSettingsToCloud(platform, toast, this.getSyncOptions(platform, syncOptions))
        } else {
            toast.error(CloudSyncLang.trans('sync.error_invalid_setting_2'))
        }
    }

    async syncLocalSettingsToCloud (platform: PlatformService, toast: ToastrService, syncOptions: SyncOptions = {}): Promise<void> {
        const savedConfigs = this.readConfigFile(platform)
        if (!savedConfigs) {
            toast.error(CloudSyncLang.trans('sync.error_invalid_setting_2'))
            return
        }
        if (!savedConfigs.enabled && !syncOptions.ignoreEnabled) {
            return
        }
        await this.adapterHandler[savedConfigs.adapter].syncLocalSettingsToCloud(platform, toast, this.getSyncOptions(platform, syncOptions))
    }

    readConfigFile (platform: PlatformService, isRaw = false): any {
        let data = null
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename
        if (fs.existsSync(filePath)) {
            try {
                const bytes = CryptoJS.AES.decrypt(fs.readFileSync(filePath, 'utf8').replace(CloudSyncLang.trans('common.config_inject_header'), ''), this.generatedCryptoHash)
                const content = bytes.toString(CryptoJS.enc.Utf8)
                data = isRaw ? content : JSON.parse(content)
            } catch (e) {
            }
        }

        return data
    }

    readTabbyConfigFile (platform: PlatformService, isRaw = false, isEncrypt = false): any {
        let data = null
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.tabbySettingsFilename
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8')
                data = isRaw
                    ? !isEncrypt ? content : this.encryptConfigContent(content)
                    : JSON.parse(content)
            } catch (e) {
            }
        }

        return data
    }

    async backupTabbyConfigFile (platform: PlatformService): Promise<any> {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.tabbySettingsFilename
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8')
                try {
                    const backupFilePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.tabbySettingsFilename + '.backup'
                    const promise = new Promise((resolve, reject) => {
                        return fs.writeFile(backupFilePath, content,
                            (err) => {
                                if (err) {
                                    reject(false)
                                }

                                resolve(true)
                            })
                    })

                    return await promise.then(status => {
                        return status
                    })
                } catch (e) {
                    return false
                }
            } catch (e) {
            }
        }
    }

    async saveIntervalSync (value: number, platform: PlatformService, toast: ToastrService): Promise<any> {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename
        if (!fs.existsSync(filePath)) {
            toast.error(CloudSyncLang.trans('sync.need_to_save_config'))
            return false
        }
        const savedConfigs = this.readConfigFile(platform)
        if (savedConfigs) {
            savedConfigs.interval_insync = value
            const fileContent = CloudSyncLang.trans('common.config_inject_header') + CryptoJS.AES.encrypt(JSON.stringify(savedConfigs), this.generatedCryptoHash).toString()

            const promise = new Promise((resolve, reject) => {
                return fs.writeFile(filePath, fileContent,
                    (err) => {
                        if (err) {
                            reject(false)
                        }

                        resolve(true)
                    })
            })

            return promise.then(status => {
                if (status) {
                    toast.info(CloudSyncLang.trans('sync.setting_changes_saved'))
                } else {
                    toast.info(CloudSyncLang.trans('sync.error_save_setting'))
                }
                return status
            })
        } else {
            toast.info(CloudSyncLang.trans('sync.error_save_setting'))
            return false
        }
    }

    async toggleEnabledPlugin (value: boolean, platform: PlatformService, toast: ToastrService): Promise<any> {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename
        if (!fs.existsSync(filePath)) {
            toast.error(CloudSyncLang.trans('sync.need_to_save_config'))
            return false
        }
        const savedConfigs = this.readConfigFile(platform)

        if (savedConfigs) {
            savedConfigs.enabled = value
            const fileContent = CloudSyncLang.trans('common.config_inject_header') + CryptoJS.AES.encrypt(JSON.stringify(savedConfigs), this.generatedCryptoHash).toString()

            const promise = new Promise((resolve, reject) => {
                return fs.writeFile(filePath, fileContent,
                    (err) => {
                        if (err) {
                            reject(false)
                        }

                        resolve(true)
                    })
            })

            return promise.then(status => {
                if (status) {
                    toast.info(CloudSyncLang.trans(value ? 'sync.sync_enabled' : 'sync.sync_disabled'))
                } else {
                    toast.info(CloudSyncLang.trans('sync.error_save_setting'))
                }
                return status
            })
        } else {
            toast.info(CloudSyncLang.trans('sync.error_save_setting'))
            return false
        }
    }

    async toggleEnabledShowLoader (value: boolean, platform: PlatformService, toast: ToastrService): Promise<any> {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename
        if (!fs.existsSync(filePath)) {
            toast.error(CloudSyncLang.trans('sync.need_to_save_config'))
            return false
        }
        const savedConfigs = this.readConfigFile(platform)

        if (savedConfigs) {
            savedConfigs.showLoader = value
            const fileContent = CloudSyncLang.trans('common.config_inject_header') + CryptoJS.AES.encrypt(JSON.stringify(savedConfigs), this.generatedCryptoHash).toString()

            const promise = new Promise((resolve, reject) => {
                return fs.writeFile(filePath, fileContent,
                    (err) => {
                        if (err) {
                            reject(false)
                        }

                        resolve(true)
                    })
            })

            return promise.then(status => {
                if (status) {
                    toast.info(value ? 'Syncing icon enabled.' : 'Syncing icon disabled.')
                } else {
                    toast.info(CloudSyncLang.trans('sync.error_save_setting'))
                }
                return status
            })
        } else {
            toast.info(CloudSyncLang.trans('sync.error_save_setting'))
            return false
        }
    }

    async removeConfirmFile (platform: PlatformService, toast: ToastrService, needConfirm = true): Promise<boolean> {
        let result = false
        try {
            if (needConfirm) {
                if ((await platform.showMessageBox({
                    type: 'warning',
                    message: CloudSyncLang.trans('sync.confirm_remove_setting'),
                    buttons: [CloudSyncLang.trans('buttons.cancel'), CloudSyncLang.trans('buttons.yes')],
                    defaultId: 1,
                })).response === 1) {
                    result = this._removeSavedConfig(platform, toast)
                }
            } else {
                result = this._removeSavedConfig(platform, toast)
            }
        } catch (error) {
            toast.error(CloudSyncLang.trans('sync.remove_setting_error'))
        }

        return result
    }

    _removeSavedConfig (platform: PlatformService, toast: ToastrService): boolean {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.storedSettingsFilename)
                toast.info(CloudSyncLang.trans('sync.remove_setting_success'))
                return true
            } catch (e) {
                toast.error(CloudSyncLang.trans('sync.remove_setting_error'))
            }
        }

        return false
    }

    /**
     * 计算内容的 SHA256 哈希值
     * Calculate SHA256 hash of content
     */
    calculateHash (content: string): string {
        return CryptoJS.SHA256(content).toString()
    }

    /**
     * 读取上次同步成功时保存的哈希值
     * Read last synced hash from local storage
     */
    readLastSyncedHash (platform: PlatformService): string | null {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.syncHashFilename
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8')
                const data = JSON.parse(content)
                return data.lastSyncedHash || null
            } catch (e) {
                return null
            }
        }
        return null
    }

    /**
     * 保存同步成功后的哈希值到本地
     * Save last synced hash to local storage
     */
    saveLastSyncedHash (platform: PlatformService, hash: string): void {
        const filePath = path.dirname(platform.getConfigPath()) + CloudSyncSettingsData.syncHashFilename
        const data = JSON.stringify({ lastSyncedHash: hash })
        fs.writeFileSync(filePath, data, 'utf8')
    }

    parseCloudContent (encryptedContent: string): { configYaml: string, meta: CloudSyncMeta | null } {
        const bytes = CryptoJS.AES.decrypt(
            encryptedContent.replace(CloudSyncLang.trans('common.config_inject_header'), ''),
            this.generatedCryptoHash,
        )
        const decrypted = bytes.toString(CryptoJS.enc.Utf8)
        return unwrapCloudEnvelope(decrypted)
    }

    doDescryption (content: string): string {
        return this.parseCloudContent(content).configYaml
    }

    verifyServerConfigIsValid (configRawData: string): boolean {
        return configRawData.includes(CloudSyncLang.trans('common.verifyConfigString'))
    }

    clearLastErrorMessage (platform: PlatformService, adapter: string, params: any): void {
        params.lastErrorMessage = ''
        this.saveSettingsToFile(platform, adapter, params)
    }

    loadPluginSettings (platform: PlatformService): void {
        const logger = new Logger(platform)
        const requestUrl = CloudSyncSettingsData.external_urls.ApiUrl + '/tabby-sync/plugin-settings'
        axios.post(requestUrl, {},{
            timeout: 30000,
        }).then((response) => {
            logger.log('Response: ' + JSON.stringify(response))
            const data = response.data
            if (data.status === 'success') {
                logger.log('Settings loaded successfully')
                CloudSyncSettingsData.formData[CloudSyncSettingsData.values.DROPBOX].apiKey = data.dropbox.apiKey
                CloudSyncSettingsData.formData[CloudSyncSettingsData.values.DROPBOX].apiSecret = data.dropbox.apiSecret
            } else {
                logger.log('Error while loading settings: ' + data.message)
            }
        })
    }
}

export default new SettingsHelperClass()
