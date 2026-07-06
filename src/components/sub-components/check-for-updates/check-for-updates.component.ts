import { Component, OnInit } from '@angular/core'
import { ConfigService, PlatformService } from 'terminus-core'
import { compare as semverCompare } from 'semver'
import axios from 'axios'
import { getPluginVersion } from '../../../utils/plugin-version'
import Lang from '../../../data/lang'

@Component({
    selector: 'check-for-updates-cloud-sync',
    template: require('./check-for-updates.component.pug'),
    styles: [require('./check-for-updates.component.scss')],
})
export class CheckForUpdatesComponent implements OnInit {
    translate = Lang
    version = getPluginVersion()
    latestVersion = ''
    isUpdateAvailable = false
    noUpdateAvailable = false
    errorCheckForUpdates = false
    isProcessingRequest = false

    constructor (
        private platform: PlatformService,
        private config: ConfigService,
    ) {}

    ngOnInit (): void {
        Lang.refreshLocale(this.platform, this.config)
    }

    async checkForPluginVersion (): Promise<void> {
        this.isProcessingRequest = true
        this.errorCheckForUpdates = false
        this.isUpdateAvailable = false
        this.noUpdateAvailable = false
        this.latestVersion = ''

        try {
            const response = await axios.get('https://registry.npmjs.org/tabby-sync-selective/latest', {
                timeout: 30000,
            })
            this.latestVersion = response.data?.version || ''
            if (this.latestVersion && semverCompare(getPluginVersion(), this.latestVersion) === -1) {
                this.isUpdateAvailable = true
            } else {
                this.noUpdateAvailable = true
            }
        } catch (e) {
            this.errorCheckForUpdates = true
        } finally {
            this.isProcessingRequest = false
        }
    }
}
