import { PeerDescriptor } from '@streamr/dht'
import { NetworkNode, NodeInfo, streamPartIdToDataKey } from '@streamr/trackerless-network'
import { StreamPartID } from '@streamr/utils'
import semver from 'semver'

type ArrayElement<ArrayType extends readonly unknown[]> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never

export type NormalizedNodeInfo = Omit<NodeInfo, 'streamPartitions'>
    & { streamPartitions: Omit<ArrayElement<NodeInfo['streamPartitions']>, 'deprecatedContentDeliveryLayerNeighbors'>[] }

const toNormalizeNodeInfo = (info: NodeInfo): NormalizedNodeInfo => {
    const isLegacyFormat = semver.satisfies(semver.coerce(info.applicationVersion)!, '< 102.0.0')
    return {
        ...info,
        streamPartitions: info.streamPartitions.map((sp) => ({
            ...sp,
            contentDeliveryLayerNeighbors: !isLegacyFormat
                ? sp.contentDeliveryLayerNeighbors
                : sp.deprecatedContentDeliveryLayerNeighbors.map((n) => ({
                    peerDescriptor: n
                }))
        }))
    }
}

export class NetworkNodeFacade {
    private readonly node: NetworkNode

    constructor(node: NetworkNode) {
        this.node = node
    }

    async fetchNodeInfo(peerDescriptor: PeerDescriptor): Promise<NormalizedNodeInfo> {
        const info = await this.node.fetchNodeInfo(peerDescriptor)
        return toNormalizeNodeInfo(info)
    }

    async fetchStreamPartEntryPoints(streamPartId: StreamPartID): Promise<PeerDescriptor[]> {
        const key = streamPartIdToDataKey(streamPartId)
        return (await this.node.stack.getControlLayerNode().fetchDataFromDht(key))
            .filter((entry) => !entry.deleted)
            .map((entry) => PeerDescriptor.fromBinary(entry.data!.value))
    }
}
