import * as fs from 'fs'
import * as path from 'path'
import { version as buildVersion } from '../../package.json'

let cachedVersion: string | null = null

/** Read version from installed package.json (matches Tabby plugin list). */
export function getPluginVersion (): string {
    if (cachedVersion) {
        return cachedVersion
    }

    const candidates = [
        path.join(__dirname, '..', 'package.json'),
        path.join(__dirname, '..', '..', 'package.json'),
    ]

    for (const pkgPath of candidates) {
        try {
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
                if (pkg.version) {
                    cachedVersion = pkg.version
                    return cachedVersion
                }
            }
        } catch {
            // try next candidate
        }
    }

    return buildVersion
}
