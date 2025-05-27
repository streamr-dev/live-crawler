import { Router } from 'express'
import { TopologyController } from '../controllers/TopologyController'

export function createRoutes(topologyController: TopologyController): Router {
    const router = Router()

    router.get('/topology', (req, res) => topologyController.getTopology(req as any, res))

    return router
}
