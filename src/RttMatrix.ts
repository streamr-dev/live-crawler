import { NormalizedNodeInfo } from "./NetworkNodeFacade"
import { DhtAddress } from "@streamr/sdk"
import { toNodeId } from "@streamr/dht"

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formPairKey(from: DhtAddress, to: DhtAddress): string {
    return [from, to].sort().join('-')
}

export class RttMatrix {
    private readonly data: Map<string, number> = new Map()

    constructor(infos: NormalizedNodeInfo[]) {
        const rttMap = new Map<string, number[]>()

        for (const info of infos) {
            const from = toNodeId(info.peerDescriptor)

            for (const partition of info.streamPartitions) {
                for (const neighbor of partition.contentDeliveryLayerNeighbors) {
                    const to = toNodeId(neighbor.peerDescriptor)
                    const pairKey = formPairKey(from, to)
                    const rttData = rttMap.get(pairKey) ?? []
                    if (neighbor.rtt !== undefined && neighbor.rtt > 0) {
                        rttData.push(neighbor.rtt)
                        rttMap.set(pairKey, rttData)
                    }
                }
            }
        }

        for (const [pairKey, rttData] of rttMap) {
            if (rttData.length > 0) {
                this.data.set(pairKey, mean(rttData))
            }
        }
    }

    getRtt(from: DhtAddress, to: DhtAddress): number | undefined {
        return this.data.get(formPairKey(from, to))
    }
}
