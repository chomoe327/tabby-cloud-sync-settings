import * as yaml from 'js-yaml'
import { PlatformService } from 'terminus-core'

const fs = require('fs')

export function getTabbyLanguage (platform: PlatformService): string {
    try {
        const configPath = platform.getConfigPath()
        if (fs.existsSync(configPath)) {
            const parsed = yaml.load(fs.readFileSync(configPath, 'utf8')) as { language?: string }
            if (parsed?.language) {
                return parsed.language
            }
        }
    } catch (e) {
        // ignore parse errors
    }
    return 'en-US'
}

export function isChineseLocale (platform: PlatformService): boolean {
    return getTabbyLanguage(platform).toLowerCase().startsWith('zh')
}
