import * as yaml from 'js-yaml'

export type SyncMode = 'full' | 'platform_safe' | 'custom'

export interface SyncFieldGroupDef {
    id: string
    label: string
    labelZh: string
}

export interface SyncFieldDef {
    id: string
    path: string
    group: string
    label: string
    labelZh: string
    platformSpecific: boolean
    defaultCustom: boolean
}

export interface SyncOptions {
    ignoreEnabled?: boolean
    syncMode?: SyncMode
    syncFields?: Record<string, boolean>
    /** Sync Tabby Vault secrets (SSH passwords, etc.) */
    syncVault?: boolean
    /** Force sync direction; manual buttons set this, auto sync uses 'auto' */
    syncDirection?: 'auto' | 'download' | 'upload'
    /** @deprecated use syncFields */
    syncSections?: Record<string, boolean>
}

export const SYNC_FIELD_GROUPS: SyncFieldGroupDef[] = [
    { id: 'appearance', label: 'Appearance', labelZh: '外观' },
    { id: 'terminal_colors', label: 'Terminal colors', labelZh: '终端颜色' },
    { id: 'terminal_behavior', label: 'Terminal behavior', labelZh: '终端行为' },
    { id: 'terminal_font', label: 'Terminal font', labelZh: '终端字体' },
    { id: 'connections', label: 'Connections', labelZh: '连接' },
    { id: 'input', label: 'Input & hotkeys', labelZh: '输入与热键' },
    { id: 'other', label: 'Other', labelZh: '其他' },
]

export const SYNC_FIELDS: SyncFieldDef[] = [
    { id: 'appearance.theme', path: 'appearance.theme', group: 'appearance', label: 'Theme', labelZh: '主题', platformSpecific: false, defaultCustom: true },
    { id: 'appearance.css', path: 'appearance.css', group: 'appearance', label: 'Custom CSS', labelZh: '自定义 CSS', platformSpecific: false, defaultCustom: true },
    { id: 'appearance.colorSchemeMode', path: 'appearance.colorSchemeMode', group: 'appearance', label: 'Color scheme mode', labelZh: '配色模式', platformSpecific: false, defaultCustom: true },
    { id: 'appearance.frame', path: 'appearance.frame', group: 'appearance', label: 'Window frame', labelZh: '窗口边框', platformSpecific: false, defaultCustom: true },
    { id: 'appearance.opacity', path: 'appearance.opacity', group: 'appearance', label: 'Opacity', labelZh: '透明度', platformSpecific: false, defaultCustom: true },
    { id: 'appearance.vibrancy', path: 'appearance.vibrancy', group: 'appearance', label: 'Vibrancy', labelZh: '毛玻璃', platformSpecific: false, defaultCustom: true },
    { id: 'appearance.vibrancyType', path: 'appearance.vibrancyType', group: 'appearance', label: 'Vibrancy type', labelZh: '毛玻璃类型', platformSpecific: false, defaultCustom: false },
    { id: 'appearance.tabsLocation', path: 'appearance.tabsLocation', group: 'appearance', label: 'Tabs location', labelZh: '标签页位置', platformSpecific: false, defaultCustom: true },
    { id: 'appearance.cycleTabs', path: 'appearance.cycleTabs', group: 'appearance', label: 'Cycle tabs', labelZh: '循环切换标签', platformSpecific: false, defaultCustom: false },
    { id: 'appearance.spaciness', path: 'appearance.spaciness', group: 'appearance', label: 'UI spaciness', labelZh: '界面间距', platformSpecific: false, defaultCustom: false },
    { id: 'appearance.dock', path: 'appearance.dock', group: 'appearance', label: 'Quake / dock mode', labelZh: 'Quake / 停靠模式', platformSpecific: false, defaultCustom: false },
    { id: 'appearance.dockScreen', path: 'appearance.dockScreen', group: 'appearance', label: 'Dock screen', labelZh: '停靠屏幕', platformSpecific: true, defaultCustom: false },
    { id: 'appearance.dockFill', path: 'appearance.dockFill', group: 'appearance', label: 'Dock fill', labelZh: '停靠占比', platformSpecific: false, defaultCustom: false },
    { id: 'appearance.flexTabs', path: 'appearance.flexTabs', group: 'appearance', label: 'Flex tabs', labelZh: '弹性标签', platformSpecific: false, defaultCustom: false },

    { id: 'terminal.colorScheme', path: 'terminal.colorScheme', group: 'terminal_colors', label: 'Dark color scheme', labelZh: '深色配色', platformSpecific: false, defaultCustom: true },
    { id: 'terminal.lightColorScheme', path: 'terminal.lightColorScheme', group: 'terminal_colors', label: 'Light color scheme', labelZh: '浅色配色', platformSpecific: false, defaultCustom: true },
    { id: 'terminal.customColorSchemes', path: 'terminal.customColorSchemes', group: 'terminal_colors', label: 'Custom color schemes', labelZh: '自定义配色方案', platformSpecific: false, defaultCustom: true },

    { id: 'terminal.scrollbackLines', path: 'terminal.scrollbackLines', group: 'terminal_behavior', label: 'Scrollback lines', labelZh: '回滚行数', platformSpecific: false, defaultCustom: true },
    { id: 'terminal.cursor', path: 'terminal.cursor', group: 'terminal_behavior', label: 'Cursor shape', labelZh: '光标形状', platformSpecific: false, defaultCustom: true },
    { id: 'terminal.cursorBlink', path: 'terminal.cursorBlink', group: 'terminal_behavior', label: 'Cursor blink', labelZh: '光标闪烁', platformSpecific: false, defaultCustom: false },
    { id: 'terminal.ligatures', path: 'terminal.ligatures', group: 'terminal_behavior', label: 'Font ligatures', labelZh: '字体连字', platformSpecific: false, defaultCustom: true },
    { id: 'terminal.bell', path: 'terminal.bell', group: 'terminal_behavior', label: 'Bell sound', labelZh: '铃声', platformSpecific: false, defaultCustom: false },
    { id: 'terminal.copyOnSelect', path: 'terminal.copyOnSelect', group: 'terminal_behavior', label: 'Copy on select', labelZh: '选中即复制', platformSpecific: false, defaultCustom: false },
    { id: 'terminal.pasteOnMiddleClick', path: 'terminal.pasteOnMiddleClick', group: 'terminal_behavior', label: 'Paste on middle click', labelZh: '中键粘贴', platformSpecific: false, defaultCustom: false },
    { id: 'terminal.altIsMeta', path: 'terminal.altIsMeta', group: 'terminal_behavior', label: 'Alt as Meta', labelZh: 'Alt 作为 Meta', platformSpecific: false, defaultCustom: false },
    { id: 'terminal.wordSeparator', path: 'terminal.wordSeparator', group: 'terminal_behavior', label: 'Word separator', labelZh: '分词符', platformSpecific: false, defaultCustom: false },
    { id: 'terminal.showBuiltinProfiles', path: 'terminal.showBuiltinProfiles', group: 'terminal_behavior', label: 'Show builtin profiles', labelZh: '显示内置配置', platformSpecific: false, defaultCustom: false },
    { id: 'terminal.showRecentProfiles', path: 'terminal.showRecentProfiles', group: 'terminal_behavior', label: 'Recent profiles count', labelZh: '最近配置数量', platformSpecific: false, defaultCustom: false },

    { id: 'terminal.font', path: 'terminal.font', group: 'terminal_font', label: 'Font family', labelZh: '字体', platformSpecific: true, defaultCustom: false },
    { id: 'terminal.fontSize', path: 'terminal.fontSize', group: 'terminal_font', label: 'Font size', labelZh: '字号', platformSpecific: false, defaultCustom: true },

    { id: 'profiles', path: 'profiles', group: 'connections', label: 'SSH / connection profiles', labelZh: 'SSH / 连接配置', platformSpecific: false, defaultCustom: true },
    { id: 'groups', path: 'groups', group: 'connections', label: 'Connection groups', labelZh: '连接分组', platformSpecific: false, defaultCustom: true },
    { id: 'profileDefaults', path: 'profileDefaults', group: 'connections', label: 'Profile defaults (shell paths)', labelZh: '配置默认值（含 shell 路径）', platformSpecific: true, defaultCustom: false },

    { id: 'hotkeys', path: 'hotkeys', group: 'input', label: 'Hotkeys', labelZh: '热键', platformSpecific: true, defaultCustom: false },

    { id: 'accessibility', path: 'accessibility', group: 'other', label: 'Accessibility', labelZh: '无障碍', platformSpecific: false, defaultCustom: true },
    { id: 'language', path: 'language', group: 'other', label: 'Language', labelZh: '语言', platformSpecific: false, defaultCustom: true },
    { id: 'recoverTabs', path: 'recoverTabs', group: 'other', label: 'Recover tabs', labelZh: '恢复标签页', platformSpecific: false, defaultCustom: false },
    { id: 'enableWelcomeTab', path: 'enableWelcomeTab', group: 'other', label: 'Welcome tab', labelZh: '欢迎页', platformSpecific: false, defaultCustom: false },
    { id: 'hideTray', path: 'hideTray', group: 'other', label: 'Hide tray icon', labelZh: '隐藏托盘图标', platformSpecific: true, defaultCustom: false },
    { id: 'hacks', path: 'hacks', group: 'other', label: 'Hacks / GPU', labelZh: 'Hacks / GPU', platformSpecific: true, defaultCustom: false },
    { id: 'electronFlags', path: 'electronFlags', group: 'other', label: 'Electron flags', labelZh: 'Electron 参数', platformSpecific: true, defaultCustom: false },
]

/** @deprecated use SYNC_FIELDS */
export const SYNC_SECTIONS = SYNC_FIELD_GROUPS.map(group => ({
    id: group.id,
    label: group.label,
    labelZh: group.labelZh,
    keys: SYNC_FIELDS.filter(f => f.group === group.id).map(f => f.path.split('.')[0]).filter((v, i, a) => a.indexOf(v) === i),
    defaultEnabled: SYNC_FIELDS.filter(f => f.group === group.id).every(f => f.defaultCustom),
}))

export function getDefaultSyncFields (): Record<string, boolean> {
    const fields: Record<string, boolean> = {}
    for (const field of SYNC_FIELDS) {
        fields[field.id] = field.defaultCustom
    }
    return fields
}

/** @deprecated use getDefaultSyncFields */
export function getDefaultSyncSections (): Record<string, boolean> {
    return getDefaultSyncFields()
}

export function getFieldsByGroup (groupId: string): SyncFieldDef[] {
    return SYNC_FIELDS.filter(field => field.group === groupId)
}

export function getGroupLabel (group: SyncFieldGroupDef, isZh: boolean): string {
    return isZh ? group.labelZh : group.label
}

export function getFieldLabel (field: SyncFieldDef, isZh: boolean): string {
    return isZh ? field.labelZh : field.label
}

export function countEnabledSyncFields (syncFields: Record<string, boolean>): number {
    return SYNC_FIELDS.filter(field => syncFields[field.id]).length
}

function normalizeSyncMode (mode: string | undefined): SyncMode {
    if (mode === 'full') {
        return 'full'
    }
    if (mode === 'custom') {
        return 'custom'
    }
    if (mode === 'platform_safe' || mode === 'selective') {
        return 'platform_safe'
    }
    return 'platform_safe'
}

function migrateLegacySections (syncSections: Record<string, boolean> | undefined): Record<string, boolean> {
    const fields = getDefaultSyncFields()
    if (!syncSections) {
        return fields
    }

    const legacyMap: Record<string, string[]> = {
        appearance: SYNC_FIELDS.filter(f => f.group === 'appearance').map(f => f.id),
        terminal: SYNC_FIELDS.filter(f => f.group.startsWith('terminal_')).map(f => f.id),
        profiles: ['profiles'],
        groups: ['groups'],
        profileDefaults: ['profileDefaults'],
        hotkeys: ['hotkeys'],
        accessibility: ['accessibility'],
        language: ['language'],
        general: ['recoverTabs', 'enableWelcomeTab', 'hideTray'],
        advanced: ['hacks', 'electronFlags'],
    }

    for (const [sectionId, enabled] of Object.entries(syncSections)) {
        const fieldIds = legacyMap[sectionId]
        if (fieldIds) {
            for (const fieldId of fieldIds) {
                fields[fieldId] = enabled
            }
        }
    }

    return fields
}

export function resolveSyncOptions (saved: any, override: SyncOptions = {}): SyncOptions {
    const syncMode = normalizeSyncMode(override.syncMode ?? saved?.syncMode)
    const syncFields = {
        ...getDefaultSyncFields(),
        ...migrateLegacySections(saved?.syncSections),
        ...(saved?.syncFields || {}),
        ...(override.syncFields || {}),
        ...(override.syncSections ? migrateLegacySections(override.syncSections) : {}),
    }

    return {
        syncMode,
        syncFields,
        syncVault: override.syncVault ?? saved?.syncVault ?? false,
        syncDirection: override.syncDirection ?? 'auto',
        ignoreEnabled: override.ignoreEnabled ?? false,
    }
}

export function parseConfigYaml (content: string): Record<string, any> {
    if (!content || !content.trim()) {
        return {}
    }
    const parsed = yaml.load(content)
    if (!parsed || typeof parsed !== 'object') {
        return {}
    }
    const obj = parsed as Record<string, any>
    if (typeof obj.configYaml === 'string' && obj._meta) {
        return parseConfigYaml(obj.configYaml)
    }
    return obj
}

export function isEncryptedConfig (obj: Record<string, any>): boolean {
    return !!obj.encrypted
}

function getValueAtPath (obj: Record<string, any>, path: string): any {
    if (!path.includes('.')) {
        return obj[path]
    }
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
        if (current == null || typeof current !== 'object') {
            return undefined
        }
        current = current[part]
    }
    return current
}

function setValueAtPath (obj: Record<string, any>, path: string, value: any): void {
    if (!path.includes('.')) {
        obj[path] = value
        return
    }
    const parts = path.split('.')
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]
        if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {}
        }
        current = current[part]
    }
    current[parts[parts.length - 1]] = value
}

function getActiveFieldDefs (options: SyncOptions): SyncFieldDef[] {
    if (options.syncMode === 'full') {
        return SYNC_FIELDS
    }

    if (options.syncMode === 'platform_safe') {
        return SYNC_FIELDS.filter(field => !field.platformSpecific)
    }

    return SYNC_FIELDS.filter(field => options.syncFields?.[field.id])
}

function applyFieldFromSource (target: Record<string, any>, source: Record<string, any>, path: string): void {
    const value = getValueAtPath(source, path)
    if (value !== undefined) {
        setValueAtPath(target, path, value)
    }
}

export function applyFieldsFromSource (target: Record<string, any>, source: Record<string, any>, options: SyncOptions): void {
    for (const field of getActiveFieldDefs(options)) {
        applyFieldFromSource(target, source, field.path)
    }
}

export function buildCanonicalPayloadFromData (data: Record<string, any>, options: SyncOptions, secrets?: any[]): string {
    const payload: Record<string, any> = {}
    const fields = getActiveFieldDefs(options).slice().sort((a, b) => a.id.localeCompare(b.id))

    for (const field of fields) {
        const value = getValueAtPath(data, field.path)
        if (value !== undefined) {
            payload[field.id] = value
        }
    }

    if (secrets?.length) {
        payload.__secrets = secrets
    }

    return JSON.stringify(payload)
}

export function buildCanonicalSyncPayload (yamlRaw: string, options: SyncOptions): string {
    const obj = parseConfigYaml(yamlRaw)
    return buildCanonicalPayloadFromData(obj, options)
}
