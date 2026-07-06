export function joinCloudPath (location: string, filename: string): string {
    const name = filename.startsWith('/') ? filename.slice(1) : filename
    if (!location || location === '/') {
        return '/' + name
    }
    const base = location.endsWith('/') ? location.slice(0, -1) : location
    return base + '/' + name
}
