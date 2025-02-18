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

export const crawlTopology = async (
    localNode: NetworkNodeFacade,
    entryPoints: PeerDescriptor[],
    getNeighbors: (nodeInfo: NormalizedNodeInfo) => PeerDescriptor[],
    runId: string
): Promise<Topology> => {
    const startTime = Date.now()
    const nodeInfos: Map<DhtAddress, NormalizedNodeInfo> = new Map()
    const errorNodes: Set<DhtAddress> = new Set()
    const visitedNodes: Set<DhtAddress> = new Set() // used to avoid duplicate entries in queue
    const queue: PeerDescriptor[] = [...entryPoints]
    const MAX_CONCURRENT = 5
    const activePromises: Set<Promise<void>> = new Set()

    const processNode = async (peerDescriptor: PeerDescriptor) => {
        const nodeId = toNodeId(peerDescriptor)
        const processed = nodeInfos.has(nodeId) || errorNodes.has(nodeId)
        if (processed) {
            return
        }
        try {
            logger.info(`Querying ${nodeId}`, { runId })
            const info = await localNode.fetchNodeInfo(peerDescriptor)
            nodeInfos.set(nodeId, info)
            visitedNodes.add(nodeId)
            let newNodesFound = 0
            for (const neighbor of getNeighbors(info)) {
                const neighborId = toNodeId(neighbor)
                if (!visitedNodes.has(neighborId)) {
                    queue.push(neighbor)
                    visitedNodes.add(neighborId)
                    newNodesFound += 1
                }
            }
            logger.info(`Queried ${nodeId}`, { runId, newNodesFound })
        } catch (err) {
            errorNodes.add(nodeId)
            logger.warn(`Query failed ${nodeId}`, { runId, peerDescriptor: createPeerDescriptorLogOutput(peerDescriptor), err })
        }
    }

    while (queue.length > 0 || activePromises.size > 0) {
        while (queue.length > 0 && activePromises.size < MAX_CONCURRENT) {
            const peerDescriptor = queue.shift()!
            const promise = processNode(peerDescriptor).finally(() => activePromises.delete(promise))
            activePromises.add(promise)
        }
        if (activePromises.size > 0) {
            await Promise.race(activePromises)
        }
    }

    logger.info(`Topology crawled`, { runId, timeTaken: Date.now() - startTime, nodeCount: nodeInfos.size, errorCount: errorNodes.size })
    const topology = await Topology.create([...nodeInfos.values()])
    return topology
}
