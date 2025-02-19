import { GeoIpLocator } from '@streamr/geoip-location'
import { Logger } from '@streamr/utils'
import iso3166Data from './iso-3166-data.json'
import { CityResponse } from "mmdb-lib/lib/reader/response"

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

const logger = new Logger(module)

const locator = new GeoIpLocator('~/geoipdatabases')

locator.start().catch((err) => {
    logger.fatal('Failed to start geoip locator', { err })
    process.exit(1)
})

const countryToSubRegionMap = new Map(
    iso3166Data.map((country: any) => [country['alpha-2'], country['sub-region']])
)

export async function fetchLocationData(ipAddress: string): Promise<LocationData> {
    try {
        // @ts-expect-error accesing priavte property
        const location: CityResponse = locator.reader.get(ipAddress)
        if (location === undefined) {
            return {}
        }
        return {
            city: location.city?.names?.en,
            country: location?.country?.names?.en,
            loc: location.location?.latitude + ',' + location.location?.longitude,
            hostname: location.traits?.domain,
            org: location.traits?.organization ?? location.traits?.isp,
            postal: location.postal?.code,
            timezone: location.location?.time_zone,
            subRegion: countryToSubRegionMap.get(location.country?.iso_code)
        }
    } catch (err) {
        logger.warn('Failed to fetch location data', { err, ipAddress })
        return {}
    }
}
