import { Component, OnInit } from '@angular/core'
import { ConfigService, PlatformService } from 'terminus-core'
import Lang from '../../data/lang'
import { github_url } from '../../../package.json'

@Component({
    selector: 'cloud-sync-feedback-form',
    template: require('./feedback.component.pug'),
    styles: [require('./feedback.component.scss')],
})
export class CloudSyncFeedbackComponent implements OnInit {
    translate = Lang
    issuesUrl = github_url + '/issues'

    constructor (
        private platform: PlatformService,
        private config: ConfigService,
    ) {}

    ngOnInit (): void {
        Lang.refreshLocale(this.platform, this.config)
    }

    openIssues (): void {
        this.platform.openExternal(this.issuesUrl)
    }
}
