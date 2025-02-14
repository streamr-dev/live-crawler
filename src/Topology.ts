import { toNodeId } from '@streamr/dht'
import { DhtAddress, StreamPartID } from '@streamr/sdk'
import { Multimap, numberToIpv4, StreamPartIDUtils } from '@streamr/utils'
import { NormalizedNodeInfo } from './NetworkNodeFacade'
import { NodeType } from "@streamr/trackerless-network/dist/generated/packages/dht/protos/DhtRpc"

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
    location?: any
}

export class Topology {
    private nodes: Map<DhtAddress, Node> = new Map()

    private constructor() {
        this.nodes = new Map()
    }

    public static async create(infos: NormalizedNodeInfo[]): Promise<Topology> {
        const topology = new Topology()
        const nodeIds = new Set(...[infos.map((info) => toNodeId(info.peerDescriptor))])
        await Promise.all(infos.map((info) => topology.initializeNode(info, nodeIds)))
        return topology
    }

    private async initializeNode(info: NormalizedNodeInfo, nodeIds: Set<DhtAddress>): Promise<void> {
        const streamPartNeighbors: Multimap<StreamPartID, DhtAddress> = new Multimap()
        for (const streamPartitionInfo of info.streamPartitions) {
            const neighbors = streamPartitionInfo.contentDeliveryLayerNeighbors
                .map((n) => toNodeId(n.peerDescriptor))
                .filter((id) => nodeIds.has(id))
            streamPartNeighbors.addAll(StreamPartIDUtils.parse(streamPartitionInfo.id), neighbors)
        }

        const nodeId = toNodeId(info.peerDescriptor)
        const allStreamPartitions = info.streamPartitions.map((sp) => sp.id)
        const websocketUrl = info.peerDescriptor.websocket?.host !== undefined
            ? `${info.peerDescriptor.websocket.host}:${info.peerDescriptor.websocket.port}`
            : undefined

        const ipAddress = info.peerDescriptor.ipAddress !== undefined
            ? numberToIpv4(info.peerDescriptor.ipAddress)
            : undefined

        const node: Node = {
            id: nodeId,
            applicationVersion: info.applicationVersion,
            websocketUrl,
            nodeType: info.peerDescriptor.type === NodeType.NODEJS ? 'NODEJS' : 'BROWSER',
            ipAddress,
            region: info.peerDescriptor.region,
            streamPartNeighbors,
            controlLayerNeighborCount: info.controlLayer.neighbors.length,
            allStreamPartitions,
            location: undefined
        }

        // Store the node first
        this.nodes.set(nodeId, node)

        // Then fetch location data if IP is available
        if (ipAddress) {
            try {
                const locationData = await this.fetchLocationData(ipAddress)
                // Update the existing node with location data
                const updatedNode = this.nodes.get(nodeId)
                if (updatedNode) {
                    updatedNode.location = locationData
                    this.nodes.set(nodeId, updatedNode)
                }
            } catch (error) {
                console.warn(`Failed to fetch location data for IP ${ipAddress}:`, error)
            }
        }
    }

    getNodes(): Node[] {
        return [...this.nodes.values()]
    }

    getNeighbors(nodeId: DhtAddress, streamPartId: StreamPartID): DhtAddress[] {
        return this.nodes.get(nodeId)?.streamPartNeighbors.get(streamPartId) ?? []
    }

    private async fetchLocationData(ipAddress: string): Promise<any> {
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
    }
}
