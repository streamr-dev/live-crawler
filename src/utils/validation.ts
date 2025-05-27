import { toStreamID, toStreamPartID } from '@streamr/utils'
import { StreamID, StreamPartID } from '@streamr/sdk'

export class ValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
    }
}

export function validateStreamId(streamIdParam: string): StreamID {
    if (!streamIdParam) {
        throw new ValidationError('streamId query parameter is required')
    }

    try {
        return toStreamID(streamIdParam)
    } catch (_err) {
        throw new ValidationError('Invalid stream ID format')
    }
}

export function validatePartition(partitionParam?: string): number {
    if (partitionParam === undefined) {
        return 0
    }

    const partition = parseInt(partitionParam)
    if (isNaN(partition)) {
        throw new ValidationError('Partition must be a number')
    }

    return partition
}

export function createStreamPartId(streamId: StreamID, partition: number): StreamPartID {
    try {
        return toStreamPartID(streamId, partition)
    } catch (_err) {
        throw new ValidationError('Could not create stream partition ID')
    }
}
