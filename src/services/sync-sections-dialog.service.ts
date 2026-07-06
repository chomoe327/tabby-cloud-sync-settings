import { Injectable } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { SyncSectionsDialogComponent } from '../components/sync-sections-dialog/sync-sections-dialog.component'
import SettingsHelper, { SyncOptions } from '../utils/settings-helper'
import { PlatformService, ConfigService } from 'terminus-core'

@Injectable()
export class SyncSectionsDialogService {
    constructor (
        private modalService: NgbModal,
        private platform: PlatformService,
        private config: ConfigService,
    ) {}

    async prompt (override: SyncOptions = {}): Promise<SyncOptions | null> {
        const defaults = SettingsHelper.getSyncOptions(this.platform, override)
        const modalRef = this.modalService.open(SyncSectionsDialogComponent, {
            centered: true,
            backdrop: 'static',
        })
        modalRef.componentInstance.syncMode = defaults.syncMode || 'platform_safe'
        modalRef.componentInstance.syncFields = { ...defaults.syncFields }
        modalRef.componentInstance.platform = this.platform
        modalRef.componentInstance.config = this.config

        try {
            const result = await modalRef.result
            return {
                ...defaults,
                ...override,
                syncMode: result.syncMode,
                syncFields: result.syncFields,
            }
        } catch (e) {
            return null
        }
    }
}
