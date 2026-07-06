import { Component, OnInit } from '@angular/core'
import { getPluginVersion } from '../../../utils/plugin-version'
import { author, support_url, github_url, date } from '../../../../package.json'
import { PlatformService } from 'terminus-core'
import CloudSyncSettingsData from '../../../data/setting-items'

@Component({
    selector: 'cloud-sync-about',
    template: require('./cloud-sync-about.component.pug'),
    styles: [require('./cloud-sync-about.component.scss')],
})
export class CloudSyncAboutComponent implements OnInit {
    showDonationLink = !!CloudSyncSettingsData.donationUrl

    info = {
        author: 'Author: ' + author,
        support_url: 'Plugin Page: ' + support_url,
        github_url: 'Github URL: ' + github_url,
        buy_me_a_cafe: 'Buy Me A Coffee',
        version: 'Version: ' + getPluginVersion() + ' - Updated date ' + date,
    }

    constructor (private platform: PlatformService) {
        // do nothing
    }

    ngOnInit (): void {
        // do nothing
    }

    openSupportUrl (): void {
        this.platform.openExternal(support_url)
    }

    openGitHubUrl (): void {
        this.platform.openExternal(github_url)
    }

    openDonationPage (): void {
        if (CloudSyncSettingsData.donationUrl) {
            this.platform.openExternal(CloudSyncSettingsData.donationUrl)
        }
    }
}
