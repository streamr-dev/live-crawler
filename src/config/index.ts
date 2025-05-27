export const config = {
    port: process.env.PORT ?? 3000,
    streamr: {
        metrics: false
    },
    crawler: {
        maxConcurrent: 5
    }
} as const

export type Config = typeof config
