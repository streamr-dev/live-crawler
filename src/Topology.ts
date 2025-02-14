import { toNodeId } from '@streamr/dht'
import { DhtAddress, StreamPartID } from '@streamr/sdk'
import { Multimap, numberToIpv4, StreamPartIDUtils } from '@streamr/utils'
import { NormalizedNodeInfo } from './NetworkNodeFacade'

export interface Node {
    id: DhtAddress
    streamPartNeighbors: Multimap<StreamPartID, DhtAddress>
    ipAddress?: string
    applicationVersion: string
}

export class Topology {

    private nodes: Map<DhtAddress, Node> = new Map()

    constructor(infos: NormalizedNodeInfo[]) {
        const nodeIds = new Set(...[infos.map((info) => toNodeId(info.peerDescriptor))])
        for (const info of infos) {
            const streamPartNeighbors: Multimap<StreamPartID, DhtAddress> = new Multimap()
            for (const streamPartitionInfo of info.streamPartitions) {
                const neighbors = streamPartitionInfo.contentDeliveryLayerNeighbors
                    .map((n) => toNodeId(n.peerDescriptor!))
                    .filter((id) => nodeIds.has(id))
                streamPartNeighbors.addAll(StreamPartIDUtils.parse(streamPartitionInfo.id), neighbors)
            }
            const nodeId = toNodeId(info.peerDescriptor)
            this.nodes.set(nodeId, {
                id: nodeId,
                applicationVersion: info.applicationVersion,
                streamPartNeighbors,
                ipAddress: (info.peerDescriptor.ipAddress !== undefined) ? numberToIpv4(info.peerDescriptor.ipAddress) : undefined
            })
        }
    }

    getNodes(): Node[] {
        return [...this.nodes.values()]
    }

    getNeighbors(nodeId: DhtAddress, streamPartId: StreamPartID): DhtAddress[] {
        return this.nodes.get(nodeId)?.streamPartNeighbors.get(streamPartId) ?? []
    }
}
