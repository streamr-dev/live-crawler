import express from 'express'
import cors from 'cors'
import path from 'path'
import { NetworkNode } from "@streamr/trackerless-network"
import { crawlTopology } from "./crawlTopology"
import { StreamrClient } from "@streamr/sdk"
import { NetworkNodeFacade, NormalizedNodeInfo } from "./NetworkNodeFacade"
import { Logger, StreamPartID, StreamPartIDUtils, toStreamID, toStreamPartID } from "@streamr/utils"

const PORT = process.env.PORT ?? 3000

const app = express()
const logger = new Logger(module)

app.use(cors())

app.use(express.static(path.join(__dirname, '../public')))

const streamrClient = new StreamrClient({
    metrics: false
})

app.get('/topology', async (req, res) => {
    const streamIdParam = req.query.streamId as string
    if (!streamIdParam) {
        res.status(400).send('Bad Request: streamId query parameter is required')
        return
    }
    const streamId = toStreamID(streamIdParam)
    const streamPartId = toStreamPartID(streamId, 0)

    try {
        const localNode = new NetworkNodeFacade((await (streamrClient.getNode()).getNode()) as NetworkNode)
        const entryPoints = await localNode.fetchStreamPartEntryPoints(streamPartId)
        const topology = await crawlTopology(localNode, entryPoints, (nodeInfo: NormalizedNodeInfo) => {
            const spInfo = nodeInfo.streamPartitions.find(({ id }) => id === streamPartId)
            return spInfo?.contentDeliveryLayerNeighbors.map(({ peerDescriptor }) => peerDescriptor) ?? []
        }, `stream-${streamId}-${Date.now()}`)

        const result = topology.getNodes().map((node) => ({
            ...node,
            neighbors: topology.getNeighbors(node.id, streamPartId),
        }))

        res.json(result)
        logger.info('Sent topology as JSON response')
    } catch (err) {
        logger.warn('Encountered error while fetching topology', { err })
        res.status(500).send('Internal Server Error')
    }
})

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`)
})
