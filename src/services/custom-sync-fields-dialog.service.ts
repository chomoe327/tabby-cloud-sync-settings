import { Injectable } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { PlatformService } from 'terminus-core'
import { CustomSyncFieldsDialogComponent } from '../components/custom-sync-fields-dialog/custom-sync-fields-dialog.component'

@Injectable()
export class CustomSyncFieldsDialogService {
    constructor (
        private modalService: NgbModal,
        private platform: PlatformService,
    ) {}

    async prompt (syncFields: Record<string, boolean>): Promise<Record<string, boolean> | null> {
        const modalRef = this.modalService.open(CustomSyncFieldsDialogComponent, {
            centered: true,
            backdrop: 'static',
            size: 'lg',
        })
        modalRef.componentInstance.syncFields = { ...syncFields }
        modalRef.componentInstance.platform = this.platform

        try {
            return await modalRef.result
        } catch (e) {
            return null
        }
    }
}
