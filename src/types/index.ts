import { DhtAddress, StreamPartID } from '@streamr/sdk'
import { Multimap } from '@streamr/utils'

export interface LocationData {
    city?: string
    country?: string
    countryCode?: string
    loc?: string
    hostname?: string
    org?: string
    postal?: string
    timezone?: string
    subRegion?: string
}

export interface Node {
    id: DhtAddress
    ipAddress?: string
    applicationVersion: string
    websocketUrl?: string
    nodeType: string
    region?: number
    streamPartNeighbors: Multimap<StreamPartID, DhtAddress>
    controlLayerNeighborCount: number
    allStreamPartitions: string[]
    location?: LocationData
}

export interface TopologyResponse {
    id: DhtAddress
    ipAddress?: string
    applicationVersion: string
    websocketUrl?: string
    nodeType: string
    region?: number
    controlLayerNeighborCount: number
    allStreamPartitions: string[]
    location?: LocationData
    neighbors: {
        id: DhtAddress
        rtt?: number
    }[]
}

export interface TopologyQueryParams {
    streamId: string
    partition?: string
}
