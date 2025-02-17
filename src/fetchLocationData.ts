import { Logger } from '@streamr/utils'

const logger = new Logger(module)

interface LocationData {
    city?: string
    country?: string
    loc?: string
    hostname?: string
    org?: string
    postal?: string
    timezone?: string
}

export async function fetchLocationData(ipAddress: string): Promise<LocationData> {
    try {
        const response = await fetch(`https://ipinfo.io/${ipAddress}?token=29de457f326044`)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json() as any
        return {
            city: data?.city,
            country: data?.country,
            loc: data?.loc,
            hostname: data?.hostname,
            org: data?.org,
            postal: data?.postal,
            timezone: data?.timezone,
        }
    } catch (err) {
        logger.warn('Failed to fetch location data', { err, ipAddress })
        return {}
    }
}
