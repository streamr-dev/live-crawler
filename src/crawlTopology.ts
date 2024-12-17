import { PeerDescriptor, toNodeId } from '@streamr/dht'
import { DhtAddress } from '@streamr/sdk'
import { Logger, binaryToHex } from '@streamr/utils'
import { NetworkNodeFacade, NormalizedNodeInfo } from './NetworkNodeFacade'
import { Topology } from './Topology'

const logger = new Logger(module)

const createPeerDescriptorLogOutput = (peerDescriptor: PeerDescriptor) => {
    return {
        nodeId: toNodeId(peerDescriptor),
        type: peerDescriptor.type,
        udp: peerDescriptor.udp,
        tcp: peerDescriptor.tcp,
        websocket: peerDescriptor.websocket,
        region: peerDescriptor.region,
        ipAddress: peerDescriptor.ipAddress,
        publicKey: (peerDescriptor.publicKey !== undefined) ? binaryToHex(peerDescriptor.publicKey) : undefined,
        signature: (peerDescriptor.signature !== undefined) ? binaryToHex(peerDescriptor.signature) : undefined
    }
}

const createNodeInfoLogOutput = (nodeInfo: NormalizedNodeInfo) => {
    return {
        peerDescriptor: createPeerDescriptorLogOutput(nodeInfo.peerDescriptor),
        streamPartitions: nodeInfo.streamPartitions.map((sp: any) => ({
            id: sp.id,
            contentDeliveryLayerNeighbors: sp.contentDeliveryLayerNeighbors.map((n: any) => toNodeId(n.peerDescriptor))  // TODO better type
        })),
        version: nodeInfo.version
    }
}

export const crawlTopology = async (
    localNode: NetworkNodeFacade,
    entryPoints: PeerDescriptor[],
    getNeighbors: (nodeInfo: NormalizedNodeInfo) => PeerDescriptor[],
    runId: string
): Promise<Topology> => {
    const nodeInfos: Map<DhtAddress, NormalizedNodeInfo> = new Map()
    const errorNodes: Set<DhtAddress> = new Set()
    const processNode = async (peerDescriptor: PeerDescriptor): Promise<void> => {
        const nodeId = toNodeId(peerDescriptor)
        const processed = nodeInfos.has(nodeId) || errorNodes.has(nodeId)
        if (processed) {
            return
        }
        try {
            logger.info(`Querying ${nodeId}`, { runId })
            const info = await localNode.fetchNodeInfo(peerDescriptor)
            nodeInfos.set(nodeId, info)
            logger.info(`Queried ${nodeId}`, { info: createNodeInfoLogOutput(info), runId })
            for (const node of getNeighbors(info)) {
                await processNode(node)
            }
        } catch (err) {
            errorNodes.add(nodeId)
            logger.warn(`Query failed ${nodeId}`, { peerDescriptor: createPeerDescriptorLogOutput(peerDescriptor), err, runId })
        }
    }
    for (const node of entryPoints) {
        await processNode(node)
    }
    logger.info(`Topology: nodeCount=${nodeInfos.size}, errors=${errorNodes.size}`, { runId })
    return new Topology([...nodeInfos.values()])
}
