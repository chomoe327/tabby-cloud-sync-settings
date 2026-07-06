// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
import { NgModule } from '@angular/core'
import { SettingsTabProvider } from 'terminus-settings'
import { SyncConfigSettingsTabProvider } from './settings'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { AppService, ConfigService, PlatformService } from 'terminus-core'
import { CloudSyncSettingsComponent } from './components/cloud-sync-settings.component'
import { ToggleComponent } from 'components/toggle.component'
import { CloudSyncAmazonSettingsComponent } from './components/sub-components/amazon/amazon-settings.component'
import { CloudSyncBuiltinSettingsComponent } from './components/sub-components/built-in/builtin-settings.component'
import { CloudSyncWebDavSettingsComponent } from './components/sub-components/webdav/webdav-settings.component'
import { CloudSyncFtpSettingsComponent } from './components/sub-components/ftp/ftp-settings.component'
import SettingsHelper from './utils/settings-helper'
import { ToastrService } from 'ngx-toastr'
import { CloudSyncAboutComponent } from './components/sub-components/about/about.component'
import { CloudSyncGistSettingsComponent } from './components/sub-components/gist/gist-settings.component'
import { CloudSyncFeedbackComponent } from './components/feeback-form/feeback.component'
import { MasterPasswordComponent } from './components/master-password/master-password.component'
import { ChangeLogsComponent } from './components/change-logs/change-logs.component'
import CloudSyncSettingsData from './data/setting-items'
import { CheckForUpdatesComponent } from './components/sub-components/check-for-updates/check-for-updates.component'
import { CloudSyncDropboxSettingsComponent } from "./components/sub-components/dropbox/dropbox-settings.component";
import Logger from "./utils/Logger";
import { PluginLogsComponent } from "./components/sub-components/plugin-logs/plugin-logs.component";
import { CheckboxComponent } from './components/checkbox.component'
import { SyncSectionsDialogComponent } from './components/sync-sections-dialog/sync-sections-dialog.component'
import { SyncSectionsDialogService } from './services/sync-sections-dialog.service'
import { CustomSyncFieldsDialogComponent } from './components/custom-sync-fields-dialog/custom-sync-fields-dialog.component'
import { CustomSyncFieldsDialogService } from './services/custom-sync-fields-dialog.service'

let autoSynInProgress = false
let autoSynIntervalInstance = null
let initAutoSynIntervalFrequency = CloudSyncSettingsData.defaultSyncInterval * 1000

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NgbModule,
    ],
    providers: [
        { provide: SettingsTabProvider, useClass: SyncConfigSettingsTabProvider, multi: true },
        SyncSectionsDialogService,
        CustomSyncFieldsDialogService,
    ],
    entryComponents: [
        CloudSyncSettingsComponent,
        SyncSectionsDialogComponent,
        CustomSyncFieldsDialogComponent,
    ],
    declarations: [
        CloudSyncAmazonSettingsComponent,
        CloudSyncBuiltinSettingsComponent,
        CloudSyncWebDavSettingsComponent,
        CloudSyncFtpSettingsComponent,
        CloudSyncSettingsComponent,
        CloudSyncGistSettingsComponent,
        CloudSyncAboutComponent,
        CloudSyncFeedbackComponent,
        MasterPasswordComponent,
        ChangeLogsComponent,
        CheckForUpdatesComponent,
        PluginLogsComponent,
        ToggleComponent,
        CheckboxComponent,
        SyncSectionsDialogComponent,
        CustomSyncFieldsDialogComponent,
        CloudSyncDropboxSettingsComponent,
    ],
})

export default class CloudSyncSettingsModule {
    constructor(private app: AppService,
        private platform: PlatformService,
        private toast: ToastrService,
        private configService: ConfigService,
        // VaultService is provided by Tabby core at runtime
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private vaultService: any) {
        SettingsHelper.setConfigService(this.configService)
        if (this.vaultService?.getPassphrase) {
            SettingsHelper.setVaultService(this.vaultService)
        }
        this.injectLoaderIndicator()
        SettingsHelper.loadPluginSettings(this.platform)
        setTimeout(async () => {
            await this.syncCloudSettings().then(() => {
                setTimeout(() => {
                    this.subscribeToConfigChangeEvent()
                }, 2000)

                this.subscribeToAutoSyncEvent()
            })
        })
    }

    subscribeToAutoSyncEvent(): void {
        // Auto Sync between local and remote every interval config set
        autoSynIntervalInstance = setTimeout(() => {
            this.syncCloudSettings().then()
        }, initAutoSynIntervalFrequency)
    }

    subscribeToConfigChangeEvent(): void {
        const logger = new Logger(this.platform)
        this.configService.changed$.subscribe(async () => {
            if (autoSynInProgress) {
                logger.log('Config changed. But auto sync is in progress. Skipping...')
                return
            }

            const savedConfigs = SettingsHelper.readConfigFile(this.platform)
            if (!savedConfigs?.enabled) {
                logger.log('Config changed. Auto sync disabled. Skipping upload...')
                return
            }

            logger.log('Config changed. Syncing local settings to cloud...')
            this.showLoaderIndicator()
            await SettingsHelper.syncLocalSettingsToCloud(this.platform, this.toast).then(() => {
                // syncLocalSettingsToCloud 内部已经会更新 hash，无需额外操作
                // hash is already updated inside syncLocalSettingsToCloud
                this.hideLoaderIndicator()
            }).catch((err) => {
                this.hideLoaderIndicator()
                logger.log('Error while syncing local settings to cloud: ' + err.message, 'error')
                this.toast.error(err.message)
            })
        })
    }

    async syncCloudSettings(): Promise<void> {
        const logger = new Logger(this.platform)
        if (!autoSynInProgress) {
            autoSynInProgress = true
            try {
                const savedConfigs = SettingsHelper.readConfigFile(this.platform)
                if (savedConfigs?.enabled) {
                    if (savedConfigs?.showLoader) {
                        this.showLoaderIndicator()
                    }

                    logger.log('Tabby Auto Sync Started ' + new Date().toLocaleString())
                    initAutoSynIntervalFrequency = (savedConfigs?.interval_insync || CloudSyncSettingsData.defaultSyncInterval) * 1000
                    await SettingsHelper.syncWithCloud(this.configService, this.platform, this.toast)
                    logger.log('Tabby Auto Sync Completed ' + new Date().toLocaleString())

                    setTimeout(() => {
                        this.hideLoaderIndicator()
                    }, 3000)
                } else {
                    logger.log('Tabby Auto Sync Disabled ' + new Date().toLocaleString())
                }
            } catch (e) {
                logger.log('Tabby Auto Sync Error: ' + e.toString(), 'error')
            } finally {
                // 确保无论成功、失败或禁用，都释放锁并调度下一次同步（always release lock and schedule next sync）
                setTimeout(() => {
                    autoSynInProgress = false
                    this.subscribeToAutoSyncEvent()
                }, 1500)
            }
        } else {
            clearTimeout(autoSynIntervalInstance)
        }
    }

    injectLoaderIndicator(): void {
        // Add an element to the end of body
        const loader = document.createElement('div')
        loader.classList.add('tabby-sync-loading')
        loader.innerHTML = '<div class="loader"></div>'
        document.body.appendChild(loader)
    }

    showLoaderIndicator(): void {
        // @ts-ignore
        document.querySelector('.tabby-sync-loading').classList.add('active')
    }

    hideLoaderIndicator(): void {
        // @ts-ignore
        document.querySelector('.tabby-sync-loading').classList.remove('active')
    }
}
