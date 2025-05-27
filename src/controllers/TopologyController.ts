import { Request, Response } from 'express'
import { Logger } from '@streamr/utils'
import { NetworkNodeFacade } from '../NetworkNodeFacade'
import { TopologyService } from '../services/TopologyService'
import { StreamrService } from '../services/StreamrService'
import { validateStreamId, validatePartition, createStreamPartId, ValidationError } from '../utils/validation'
import { TopologyQueryParams } from '../types'

export class TopologyController {
    private readonly logger = new Logger(module)
    private readonly topologyService: TopologyService
    private readonly streamrService: StreamrService

    constructor(topologyService: TopologyService, streamrService: StreamrService) {
        this.topologyService = topologyService
        this.streamrService = streamrService
    }

    async getTopology(req: Request<object, object, object, TopologyQueryParams>, res: Response): Promise<void> {
        try {
            // Validate request parameters
            const streamId = validateStreamId(req.query.streamId)
            const partition = validatePartition(req.query.partition)
            const streamPartId = createStreamPartId(streamId, partition)

            // Get network node and fetch topology
            const networkNode = await this.streamrService.getNetworkNode()
            const localNode = new NetworkNodeFacade(networkNode)

            const topology = await this.topologyService.getTopology(localNode, streamPartId)

            res.json(topology)
            this.logger.info('Sent topology as JSON response', { streamPartId })
        } catch (err) {
            this.handleError(err, res)
        }
    }

    private handleError(err: unknown, res: Response): void {
        if (err instanceof ValidationError) {
            res.status(400).send(`Bad Request: ${err.message}`)
            return
        }

        this.logger.warn('Encountered error while processing topology request', { err })
        res.status(500).send('Internal Server Error')
    }
}
