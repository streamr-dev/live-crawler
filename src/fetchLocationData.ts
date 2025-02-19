import { Logger } from '@streamr/utils'
import iso3166Data from './iso-3166-data.json'

const logger = new Logger(module)

interface LocationData {
    city?: string
    country?: string
    loc?: string
    hostname?: string
    org?: string
    postal?: string
    timezone?: string
    subRegion?: string
}

const countryToSubRegionMap = new Map(
    iso3166Data.map((country: any) => [country['alpha-2'], country['sub-region']])
)

// TODO: clean up cache
const locationCache = new Map<string, LocationData>()

export async function fetchLocationData(ipAddress: string): Promise<LocationData> {
    const cachedData = locationCache.get(ipAddress)
    if (cachedData !== undefined) {
        return cachedData
    }

    try {
        const response = await fetch(`https://ipinfo.io/${ipAddress}?token=29de457f326044`)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json() as any
        const locationData = {
            city: data?.city,
            country: data?.country,
            loc: data?.loc,
            hostname: data?.hostname,
            org: data?.org,
            postal: data?.postal,
            timezone: data?.timezone,
            subRegion: data?.country !== undefined ? countryToSubRegionMap.get(data.country) : undefined
        }

        locationCache.set(ipAddress, locationData)
        return locationData
    } catch (err) {
        logger.warn('Failed to fetch location data', { err, ipAddress })
        return {}
    }
}
