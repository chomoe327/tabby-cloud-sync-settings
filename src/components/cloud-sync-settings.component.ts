import { compare as semverCompare } from 'semver'
import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core'
import { ConfigService, PlatformService, BaseComponent } from 'terminus-core'
import { ToastrService } from 'ngx-toastr'
import { Subscription } from 'rxjs'
import CloudSyncSettingsData from '../data/setting-items'
import Lang from '../data/lang'
import SettingsHelper from '../utils/settings-helper'
import axios from 'axios'
import { version } from '../../package.json'
import devConstants from '../services/dev-constants'
import { SYNC_FIELDS, SyncMode, countEnabledSyncFields, getDefaultSyncFields } from '../utils/config-merge'
import { CustomSyncFieldsDialogService } from '../services/custom-sync-fields-dialog.service'

/** @hidden */
@Component({
    template: require('./cloud-sync-settings.component.pug'),
    styles: [require('./cloud-sync-settings.component.scss')],
})

export class CloudSyncSettingsComponent extends BaseComponent implements OnInit, OnDestroy {
    lastVersion = ''
    translate = Lang
    isUpdateAvailable = false
    isDebug = devConstants.ENABLE_DEBUG

    serviceProviderValues = CloudSyncSettingsData.values
    serviceProviders = CloudSyncSettingsData.serviceProvidersList
    selectedProvider = ''

    form_messages = {
        errors: [],
        success: [],
    }
    syncEnabled = false
    isShowSyncLoader = true
    intervalSync = CloudSyncSettingsData.defaultSyncInterval
    storedSettingsData = null
    syncMode: SyncMode = 'platform_safe'
    syncFields = getDefaultSyncFields()
    totalSyncFields = SYNC_FIELDS.length

    private configSubscription: Subscription

    @HostBinding('class.content-box') true
    constructor (
        public config: ConfigService,
        private toast: ToastrService,
        private platform: PlatformService,
        private customFieldsDialog: CustomSyncFieldsDialogService,
    ) {
        super()
    }

    ngOnInit (): void {
        this.refreshLocale()
        this.configSubscription = this.config.changed$.subscribe(() => this.refreshLocale())
        this.checkForNewVersion().then()
        this.storedSettingsData = SettingsHelper.readConfigFile(this.platform)
        if (this.storedSettingsData) {
            this.selectedProvider = this.storedSettingsData.adapter
            this.syncEnabled = this.storedSettingsData.enabled
            this.isShowSyncLoader = !!this.storedSettingsData?.showLoader
            this.intervalSync = this.storedSettingsData?.interval_insync || CloudSyncSettingsData.defaultSyncInterval
            const syncOptions = SettingsHelper.getSyncOptions(this.platform)
            this.syncMode = syncOptions.syncMode
            this.syncFields = { ...syncOptions.syncFields }
        } else {
            this.selectedProvider = this.serviceProviderValues.S3
        }
    }

    ngOnDestroy (): void {
        if (this.configSubscription) {
            this.configSubscription.unsubscribe()
        }
    }

    refreshLocale (): void {
        Lang.refreshLocale(this.platform)
    }

    getCustomFieldsSummary (): string {
        const count = countEnabledSyncFields(this.syncFields)
        return Lang.trans('sync.custom_fields_summary', { count, total: this.totalSyncFields })
    }

    onSyncModeChange (mode: SyncMode): void {
        this.syncMode = mode
    }

    async openCustomFieldsDialog (): Promise<void> {
        const result = await this.customFieldsDialog.prompt(this.syncFields)
        if (result) {
            this.syncFields = result
        }
    }

    async checkForNewVersion (): Promise<void> {
        await axios.get('https://registry.npmjs.org/tabby-sync-selective/latest', {
            timeout: 30000,
        }).then((response) => {
            const latestVersion = response.data?.version
            if (latestVersion && semverCompare(version, latestVersion) === -1) {
                this.isUpdateAvailable = true
                this.lastVersion = latestVersion
            }
        }).catch(() => {
            // ignore update check failures
        })
    }

    onSelectProviderChange (): void {
        this.resetFormMessages()
    }

    async toggleEnableSync(): Promise<void> {
        await SettingsHelper.toggleEnabledPlugin(this.syncEnabled, this.platform, this.toast)
    }

    async toggleEnableShowLoader(): Promise<void> {
        await SettingsHelper.toggleEnabledShowLoader(this.isShowSyncLoader, this.platform, this.toast)
    }

    onIntervalSyncChanged (): void {
        SettingsHelper.saveIntervalSync(this.intervalSync, this.platform, this.toast).then((result) => {
            if (result) {
                this.config.requestRestart()
            }
        })
    }

    async saveSyncSectionSettings (): Promise<void> {
        const saved = await SettingsHelper.saveSyncSectionSettings(
            this.platform,
            this.toast,
            this.syncMode,
            this.syncFields,
        )
        if (saved) {
            this.storedSettingsData = SettingsHelper.readConfigFile(this.platform)
        }
    }

    resetFormMessages (): void {
        this.form_messages.errors = []
        this.form_messages.success = []
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    setFormMessage (params: any): void {
        switch (params.type) {
            case 'success': {
                this.form_messages.success.push(params.message)
                break
            }

            case 'error': {
                this.form_messages.errors.push(params.message)
                break
            }
        }
    }
}
