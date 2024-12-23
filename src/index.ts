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

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'))
})

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
            const streamPartitions = nodeInfo.streamPartitions.filter(
                (sp) => StreamPartIDUtils.getStreamID(sp.id as StreamPartID) === streamId
            )
            return streamPartitions.map((sp) => sp.contentDeliveryLayerNeighbors.map((info) => info.peerDescriptor!)).flat()
        }, `stream-${streamId}-${Date.now()}`)

        const result = topology.getNodes().map(({ id, ipAddress }) => ({
            id,
            ipAddress,
            neighbors: topology.getNeighbors(id, streamPartId)
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
