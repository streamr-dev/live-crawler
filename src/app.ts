import express from 'express'
import cors from 'cors'
import path from 'path'
import { Logger } from '@streamr/utils'
import { createRoutes } from './routes'
import { TopologyController } from './controllers/TopologyController'

const logger = new Logger(module)

export function createApp(topologyController: TopologyController): express.Application {
    const app = express()

    // Middleware
    app.use(cors())
    app.use(express.static(path.join(__dirname, '../public')))

    // Routes
    app.use('/', createRoutes(topologyController))

    // Health check endpoint
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() })
    })

    // 404 handler
    app.use('*', (_req, res) => {
        res.status(404).json({ error: 'Not Found' })
    })

    // Error handler
    app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
        logger.error('Unhandled error', { err, url: req.url, method: req.method })
        res.status(500).json({ error: 'Internal Server Error' })
    })

    return app
}
