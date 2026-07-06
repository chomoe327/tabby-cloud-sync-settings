import { Component, Input, OnInit } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, PlatformService } from 'terminus-core'
import Lang from '../../data/lang'
import { SYNC_FIELD_GROUPS, getDefaultSyncFields, getFieldsByGroup, getGroupLabel, getFieldLabel } from '../../utils/config-merge'

@Component({
    template: require('./custom-sync-fields-dialog.component.pug'),
    styles: [require('./custom-sync-fields-dialog.component.scss')],
})
export class CustomSyncFieldsDialogComponent implements OnInit {
    translate = Lang
    fieldGroups = SYNC_FIELD_GROUPS
    getFieldsByGroup = getFieldsByGroup
    getGroupLabel = getGroupLabel
    getFieldLabel = getFieldLabel

    @Input() syncFields: Record<string, boolean> = getDefaultSyncFields()

    constructor (
        public activeModal: NgbActiveModal,
        public platform: PlatformService,
        private config: ConfigService,
    ) {}

    ngOnInit (): void {
        Lang.refreshLocale(this.platform, this.config)
    }

    confirm (): void {
        this.activeModal.close({ ...this.syncFields })
    }

    cancel (): void {
        this.activeModal.dismiss()
    }
}
