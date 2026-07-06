// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
import { PlatformService } from 'terminus-core'
import moment from 'moment'

const fs = require('fs')
const path = require('path')

interface LogEntry {
    level: string
    time: string
    message: string
}

export default class Logger {
    private platform: PlatformService

    constructor (platform: PlatformService) {
        this.platform = platform
    }

    private getLogDir (): string {
        return path.dirname(this.platform.getConfigPath()) + '/tabby-sync'
    }

    getCurrentLoggerFile (): string {
        return this.getLogDir() + '/' + moment().format('DD-MM-YYYY') + '.log'
    }

    private ensureLogDir (): void {
        const dir = this.getLogDir()
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
    }

    getLogContents (callback: any, date: string = moment().format('DD-MM-YYYY'), limit = 1000): void {
        const loggerFile = this.getLogDir() + '/' + date + '.log'

        if (!fs.existsSync(loggerFile)) {
            callback(new Error('Log file is not exist.'), { file: [] })
            return
        }

        try {
            const content = fs.readFileSync(loggerFile, 'utf8')
            const lines = content.split('\n').filter((line: string) => line.trim())
            const entries: LogEntry[] = []

            for (const line of lines) {
                try {
                    entries.push(JSON.parse(line))
                } catch (e) {
                    // skip malformed lines
                }
            }

            const file = entries
                .slice(-limit)
                .reverse()
                .map(entry => ({
                    level: entry.level,
                    time: entry.time,
                    message: entry.message,
                }))

            callback(null, { file })
        } catch (err) {
            callback(err, { file: [] })
        }
    }

    log (content: any, level = 'info'): void {
        try {
            this.ensureLogDir()
            const entry: LogEntry = {
                level,
                time: new Date().toLocaleString(),
                message: typeof content === 'string' ? content : String(content),
            }
            fs.appendFileSync(this.getCurrentLoggerFile(), JSON.stringify(entry) + '\n', 'utf8')
        } catch (e) {
            // logging must never break plugin startup
            console.error('[tabby-sync-selective]', content)
        }
    }
}
