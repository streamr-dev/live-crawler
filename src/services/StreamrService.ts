import { StreamrClient } from '@streamr/sdk'
import { NetworkNode } from '@streamr/trackerless-network'
import { Logger } from '@streamr/utils'
import { Config } from '../config'

export class StreamrService {
    private readonly client: StreamrClient
    private readonly logger = new Logger(module)

    constructor(config: Config) {
        this.client = new StreamrClient({
            metrics: config.streamr.metrics
        })
    }

    async initialize(): Promise<void> {
        try {
            await this.client.connect()
            this.logger.info('Streamr client connected successfully')
        } catch (err) {
            this.logger.fatal('Failed to start Streamr client', { err })
            throw err
        }
    }

    async getNetworkNode(): Promise<NetworkNode> {
        return (this.client.getNode()).getNode() as unknown as NetworkNode
    }

    async destroy(): Promise<void> {
        await this.client.destroy()
        this.logger.info('Streamr client destroyed')
    }
}
