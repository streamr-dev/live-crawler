import { toNodeId } from '@streamr/dht'
import { DhtAddress, StreamPartID } from '@streamr/sdk'
import { Multimap, numberToIpv4, StreamPartIDUtils } from '@streamr/utils'
import { NormalizedNodeInfo } from './NetworkNodeFacade'
import { NodeType } from "@streamr/trackerless-network/dist/generated/packages/dht/protos/DhtRpc"
import { fetchLocationData } from "./fetchLocationData"

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

        const location = ipAddress !== undefined
            ? await fetchLocationData(ipAddress)
            : undefined

        this.nodes.set(nodeId, {
            id: nodeId,
            ipAddress,
            location,
            region: info.peerDescriptor.region,
            applicationVersion: info.applicationVersion,
            websocketUrl,
            nodeType: info.peerDescriptor.type === NodeType.NODEJS ? 'NODEJS' : 'BROWSER',
            streamPartNeighbors,
            controlLayerNeighborCount: info.controlLayer.neighbors.length,
            allStreamPartitions
        })
    }

    getNodes(): Node[] {
        return [...this.nodes.values()]
    }

    getNeighbors(nodeId: DhtAddress, streamPartId: StreamPartID): DhtAddress[] {
        return this.nodes.get(nodeId)?.streamPartNeighbors.get(streamPartId) ?? []
    }
}
