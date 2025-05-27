import { StreamPartID } from '@streamr/sdk'
import { Logger } from '@streamr/utils'
import { NetworkNodeFacade, NormalizedNodeInfo } from '../NetworkNodeFacade'
import { crawlTopology } from '../crawlTopology'
import { Topology } from '../Topology'
import { RttMatrix } from '../RttMatrix'
import { TopologyResponse } from '../types'
import { Config } from '../config'

export class TopologyService {
    private readonly logger = new Logger(module)
    private readonly config: Config

    constructor(config: Config) {
        this.config = config
    }

    async getTopology(
        localNode: NetworkNodeFacade,
        streamPartId: StreamPartID
    ): Promise<TopologyResponse[]> {
        try {
            const entryPoints = await localNode.fetchStreamPartEntryPoints(streamPartId)

            const { topology, rttMatrix } = await crawlTopology(
                localNode,
                entryPoints,
                (nodeInfo: NormalizedNodeInfo) => {
                    const spInfo = nodeInfo.streamPartitions.find(({ id }) => id === streamPartId)
                    return spInfo?.contentDeliveryLayerNeighbors.map(({ peerDescriptor }) => peerDescriptor) ?? []
                },
                `${streamPartId}/${Date.now()}`,
                this.config.crawler.maxConcurrent
            )

            return TopologyService.formatTopologyResponse(topology, rttMatrix, streamPartId)
        } catch (err) {
            this.logger.warn('Encountered error while fetching topology', { err, streamPartId })
            throw err
        }
    }

    private static formatTopologyResponse(
        topology: Topology,
        rttMatrix: RttMatrix,
        streamPartId: StreamPartID
    ): TopologyResponse[] {
        return topology.getNodes().map((node) => ({
            id: node.id,
            ipAddress: node.ipAddress,
            applicationVersion: node.applicationVersion,
            websocketUrl: node.websocketUrl,
            nodeType: node.nodeType,
            region: node.region,
            controlLayerNeighborCount: node.controlLayerNeighborCount,
            allStreamPartitions: node.allStreamPartitions,
            location: node.location,
            neighbors: topology.getNeighbors(node.id, streamPartId).map((neighbor) => ({
                id: neighbor,
                rtt: rttMatrix.getRtt(node.id, neighbor)
            }))
        }))
    }
}
