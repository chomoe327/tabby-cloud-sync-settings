import { Component, Input, OnInit } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { PlatformService } from 'terminus-core'
import Lang from '../../data/lang'
import { SYNC_FIELD_GROUPS, SyncMode, getDefaultSyncFields, getFieldsByGroup, getGroupLabel, getFieldLabel, countEnabledSyncFields, SYNC_FIELDS } from '../../utils/config-merge'
import { CustomSyncFieldsDialogService } from '../../services/custom-sync-fields-dialog.service'

@Component({
    template: require('./sync-sections-dialog.component.pug'),
    styles: [require('./sync-sections-dialog.component.scss')],
})
export class SyncSectionsDialogComponent implements OnInit {
    translate = Lang
    fieldGroups = SYNC_FIELD_GROUPS
    getFieldsByGroup = getFieldsByGroup
    getGroupLabel = getGroupLabel
    getFieldLabel = getFieldLabel
    totalSyncFields = SYNC_FIELDS.length

    @Input() syncMode: SyncMode = 'platform_safe'
    @Input() syncFields: Record<string, boolean> = getDefaultSyncFields()

    constructor (
        public activeModal: NgbActiveModal,
        public platform: PlatformService,
        private customFieldsDialog: CustomSyncFieldsDialogService,
    ) {}

    ngOnInit (): void {
        Lang.refreshLocale(this.platform)
    }

    onSyncModeChange (mode: SyncMode): void {
        this.syncMode = mode
    }

    getCustomFieldsSummary (): string {
        const count = countEnabledSyncFields(this.syncFields)
        return Lang.trans('sync.custom_fields_summary', { count, total: this.totalSyncFields })
    }

    async openCustomFieldsDialog (): Promise<void> {
        const result = await this.customFieldsDialog.prompt(this.syncFields)
        if (result) {
            this.syncFields = result
        }
    }

    confirm (): void {
        this.activeModal.close({
            syncMode: this.syncMode,
            syncFields: { ...this.syncFields },
        })
    }

    cancel (): void {
        this.activeModal.dismiss()
    }
}
