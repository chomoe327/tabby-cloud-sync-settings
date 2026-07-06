import { Component, OnInit } from '@angular/core'
import { ConfigService, PlatformService } from 'terminus-core'
import Lang from '../../data/lang'
import { github_url } from '../../../package.json'

interface ChangelogEntry {
    version: string
    date: string
    items: { en: string, zh: string }[]
}

@Component({
    selector: 'change-logs-cloud-sync',
    template: require('./change-logs.component.pug'),
    styles: [require('./change-logs.component.scss')],
})
export class ChangeLogsComponent implements OnInit {
    translate = Lang
    pluginUrl = github_url

    entries: ChangelogEntry[] = [
        {
            version: '1.3.0',
            date: '2026-07-06',
            items: [
                { en: 'Cross-mode sync: Full / Cross-platform / Custom share one cloud file', zh: '跨模式兼容：全量 / 跨平台 / 自定义共用一份云端配置' },
                { en: 'Cloud payload metadata (_meta) with upload mode and timestamp', zh: '云端配置增加 _meta 元数据（上传模式、时间戳等）' },
                { en: 'Unified per-field hash across all sync modes', zh: '统一各模式的字段级 hash 计算' },
            ],
        },
        {
            version: '1.2.5',
            date: '2026-07-06',
            items: [
                { en: 'Fix Tabby startup crash (NG0202) from VaultService injection', zh: '修复注入 VaultService 导致 Tabby 启动失败（NG0202）' },
            ],
        },
        {
            version: '1.2.4',
            date: '2026-07-06',
            items: [
                { en: 'Fix version display reading from installed package.json', zh: '修复版本号显示与插件列表不一致的问题' },
            ],
        },
        {
            version: '1.2.3',
            date: '2026-07-06',
            items: [
                { en: 'Decrypt encrypted cloud/local config before selective merge', zh: '选择性同步前先解密云端/本机加密配置再合并' },
                { en: 'Local encrypted or plain output is independent of cloud format', zh: '本机是否加密与云端格式无关，按本机设置保存' },
            ],
        },
        {
            version: '1.2.2',
            date: '2026-07-06',
            items: [
                { en: 'Fix sync when Tabby encrypted config is enabled (vault-only path)', zh: '修复开启「加密配置文件」后同步无变化的问题' },
                { en: 'Auto-enable vault sync and show warning in Sync Settings', zh: '加密模式下自动同步 Vault 并显示说明' },
            ],
        },
        {
            version: '1.2.0',
            date: '2026-07-06',
            items: [
                { en: 'Optional Vault encrypted blob sync', zh: '可选同步 Vault 加密数据' },
                { en: 'Sync Settings tab + custom fields dialog', zh: '独立同步设置 Tab + 自定义项弹窗' },
                { en: 'Bilingual UI following Tabby language', zh: '跟随 Tabby 语言的中英文界面' },
            ],
        },
        {
            version: '1.1.5',
            date: '2026-07-06',
            items: [
                { en: 'UI polish for sync modes', zh: '同步模式界面优化' },
            ],
        },
        {
            version: '1.1.4',
            date: '2026-07-06',
            items: [
                { en: 'Fix WebDAV via runtime webdav dependency', zh: '修复 WebDAV 运行时依赖问题' },
            ],
        },
        {
            version: '1.1.0',
            date: '2026-07-06',
            items: [
                { en: 'Selective config merge sync', zh: '选择性配置分区同步' },
                { en: 'New npm package tabby-sync-selective', zh: '新 npm 包 tabby-sync-selective' },
            ],
        },
    ]

    constructor (
        private platform: PlatformService,
        private config: ConfigService,
    ) {}

    ngOnInit (): void {
        Lang.refreshLocale(this.platform, this.config)
    }

    itemText (item: { en: string, zh: string }): string {
        return Lang.isChinese() ? item.zh : item.en
    }

    openPluginPage (): void {
        this.platform.openExternal(this.pluginUrl)
    }
}
