import { Logger } from '@streamr/utils'
import { config } from './config'
import { StreamrService } from './services/StreamrService'
import { TopologyService } from './services/TopologyService'
import { TopologyController } from './controllers/TopologyController'
import { createApp } from './app'

const logger = new Logger(module)

async function startServer(): Promise<void> {
    try {
        // Initialize services
        const streamrService = new StreamrService(config)
        await streamrService.initialize()

        const topologyService = new TopologyService(config)

        // Initialize controllers
        const topologyController = new TopologyController(topologyService, streamrService)

        // Create and start Express app
        const app = createApp(topologyController)

        const server = app.listen(config.port, () => {
            logger.info(`Server is running on port ${config.port}`)
        })

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info(`Received ${signal}, shutting down gracefully`)

            server.close(async () => {
                try {
                    await streamrService.destroy()
                    logger.info('Server shut down successfully')
                    process.exit(0)
                } catch (err) {
                    logger.error('Error during shutdown', { err })
                    process.exit(1)
                }
            })
        }

        process.on('SIGTERM', () => shutdown('SIGTERM'))
        process.on('SIGINT', () => shutdown('SIGINT'))

    } catch (err) {
        logger.fatal('Failed to start server', { err })
        process.exit(1)
    }
}

// Start the server
startServer().catch((err) => {
    logger.fatal('Unhandled error during server startup', { err })
    process.exit(1)
})
