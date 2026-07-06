import * as yaml from 'js-yaml'
import { ConfigService, PlatformService } from 'terminus-core'

const fs = require('fs')

export function getTabbyLanguage (platform: PlatformService, config?: ConfigService): string {
    try {
        const store = (config as { store?: { language?: string } } | undefined)?.store
        if (store?.language) {
            return store.language
        }
    } catch (e) {
        // ignore
    }

    try {
        const configPath = platform.getConfigPath()
        if (fs.existsSync(configPath)) {
            const parsed = yaml.load(fs.readFileSync(configPath, 'utf8')) as { language?: string, encrypted?: boolean }
            if (parsed?.language) {
                return parsed.language
            }
        }
    } catch (e) {
        // ignore parse errors
    }

    if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language
    }

    return 'en-US'
}

export function isChineseLocale (platform: PlatformService, config?: ConfigService): boolean {
    return getTabbyLanguage(platform, config).toLowerCase().startsWith('zh')
}
