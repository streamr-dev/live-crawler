export function computeNetworkStats(nodes, links) {
    const adjacencyList = new Map();

    nodes.forEach(node => {
        adjacencyList.set(node.id, []);
    });

    links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        adjacencyList.get(sourceId).push(targetId);
        adjacencyList.get(targetId).push(sourceId);
    });

    let diameter = 0;
    let totalPathLength = 0;
    let totalPaths = 0;

    // Function to perform BFS and find shortest paths from a source node
    function bfs(startId) {
        const visited = new Set();
        const queue = [];
        const distances = new Map();

        visited.add(startId);
        queue.push(startId);
        distances.set(startId, 0);

        while (queue.length > 0) {
            const currentId = queue.shift();
            const neighbors = adjacencyList.get(currentId);

            neighbors.forEach(neighborId => {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                    distances.set(neighborId, distances.get(currentId) + 1);
                }
            });
        }

        return distances;
    }

    // Compute the shortest paths between all pairs of nodes
    nodes.forEach(node => {
        const distances = bfs(node.id);
        distances.forEach((distance, targetId) => {
            if (targetId !== node.id) {  // Don't count paths to self
                totalPathLength += distance;
                totalPaths++;
                if (distance > diameter) {
                    diameter = distance;
                }
            }
        });
    });

    const averagePathLength = (totalPathLength / totalPaths).toFixed(2);
    return { diameter, averagePathLength };
}

export function computeNodeStats(nodes) {
    const subRegionStats = new Map();
    const versionStats = new Map();

    nodes.forEach(node => {
        // Count subRegions
        const subRegion = node.location?.subRegion || 'Unknown';
        subRegionStats.set(subRegion, (subRegionStats.get(subRegion) || 0) + 1);

        // Count application versions
        const version = node.applicationVersion || 'Unknown';
        versionStats.set(version, (versionStats.get(version) || 0) + 1);
    });

    // Convert subRegions to sorted array - show all regions without "Others" grouping
    const subRegionResults = [...subRegionStats.entries()]
        .sort((a, b) => b[1] - a[1]);

    // Sort versions
    const versionSorted = [...versionStats.entries()]
        .sort((a, b) => b[1] - a[1]);

    return {
        subRegions: subRegionResults,
        versions: versionSorted
    };
}

export function computeAssortativityByRegion(nodes, links) {
    let sameRegionLinks = 0;
    let totalLinks = links.length;

    links.forEach(link => {
        const sourceNode = nodes.find(node => node.id === link.source);
        const targetNode = nodes.find(node => node.id === link.target);

        if (sourceNode && targetNode && sourceNode.location?.subRegion === targetNode.location?.subRegion) {
            sameRegionLinks++;
        }
    });

    return (sameRegionLinks / totalLinks).toFixed(2);
}

// Degree-preserving assortativity by region maximization
export function buildAssortativityByRegionMaximizedLinks(nodes, originalLinks) {
    const regionGroups = new Map();
    const nodeDegrees = new Map();
    const adjacencyList = new Map();

    // Initialize node degrees and adjacency list
    nodes.forEach(node => {
        nodeDegrees.set(node.id, 0);
        adjacencyList.set(node.id, new Set());
        const region = node?.location?.subRegion || 'Unknown';
        if (!regionGroups.has(region)) {
            regionGroups.set(region, []);
        }
        regionGroups.get(region).push(node);
    });

    // Calculate original degree for each node
    originalLinks.forEach(link => {
        nodeDegrees.set(link.source, nodeDegrees.get(link.source) + 1);
        nodeDegrees.set(link.target, nodeDegrees.get(link.target) + 1);
    });

    // Function to add a link
    function addLink(source, target) {
        adjacencyList.get(source).add(target);
        adjacencyList.get(target).add(source);
        nodeDegrees.set(source, nodeDegrees.get(source) - 1);
        nodeDegrees.set(target, nodeDegrees.get(target) - 1);
    }

    // Connect regions by creating a path
    const regions = Array.from(regionGroups.keys());
    for (let i = 0; i < regions.length - 1; i++) { // Skip the last iteration
        const currentRegion = regions[i];
        const nextRegion = regions[i + 1];
        const currentNodes = regionGroups.get(currentRegion);
        const nextNodes = regionGroups.get(nextRegion);

        // Find representative nodes with available degree
        const currentRep = currentNodes.find(node => nodeDegrees.get(node.id) > 0);
        const nextRep = nextNodes.find(node => nodeDegrees.get(node.id) > 0);

        if (currentRep && nextRep) {
            addLink(currentRep.id, nextRep.id);
        }
    }

    // Maximize intra-region links
    regionGroups.forEach(nodesInRegion => {
        for (let i = 0; i < nodesInRegion.length; i++) {
            for (let j = i + 1; j < nodesInRegion.length; j++) {
                const nodeA = nodesInRegion[i];
                const nodeB = nodesInRegion[j];
                if (nodeDegrees.get(nodeA.id) > 0 && nodeDegrees.get(nodeB.id) > 0) {
                    addLink(nodeA.id, nodeB.id);
                }
            }
        }
    });

    // Connect leftover nodes between regions
    const leftoverNodes = nodes.filter(node => nodeDegrees.get(node.id) > 0);
    for (let i = 0; i < leftoverNodes.length; i++) {
        for (let j = i + 1; j < leftoverNodes.length; j++) {
            const nodeA = leftoverNodes[i];
            const nodeB = leftoverNodes[j];
            if (nodeDegrees.get(nodeA.id) > 0 && nodeDegrees.get(nodeB.id) > 0) {
                addLink(nodeA.id, nodeB.id);
            }
        }
    }

    // Convert adjacency list back to links
    const newLinks = [];
    adjacencyList.forEach((neighbors, nodeId) => {
        neighbors.forEach(neighborId => {
            if (nodeId < neighborId) { // Avoid duplicate edges
                newLinks.push({ source: nodeId, target: neighborId });
            }
        });
    });

    return newLinks;
}

// Degree-preserving randomization of links
export function buildRandomizedLinks(nodes, originalLinks) {
    const nodeDegrees = new Map();
    const adjacencyList = new Map();

    // Initialize node degrees and adjacency list
    nodes.forEach(node => {
        nodeDegrees.set(node.id, 0);
        adjacencyList.set(node.id, new Set());
    });

    // Calculate original degree for each node
    originalLinks.forEach(link => {
        nodeDegrees.set(link.source, nodeDegrees.get(link.source) + 1);
        nodeDegrees.set(link.target, nodeDegrees.get(link.target) + 1);
    });

    // Function to add a link
    function addLink(source, target) {
        adjacencyList.get(source).add(target);
        adjacencyList.get(target).add(source);
    }

    // Create a pool of all "stubs" (half-edges) that need to be connected
    let stubs = [];
    nodeDegrees.forEach((degree, nodeId) => {
        for (let i = 0; i < degree; i++) {
            stubs.push(nodeId);
        }
    });

    // Randomly shuffle the stubs
    for (let i = stubs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stubs[i], stubs[j]] = [stubs[j], stubs[i]];
    }

    // Connect pairs of stubs randomly
    const newLinks = [];
    while (stubs.length >= 2) {
        const source = stubs.pop();
        let targetIndex = -1;

        // Find a valid target (not self-loop or duplicate)
        for (let i = stubs.length - 1; i >= 0; i--) {
            const potentialTarget = stubs[i];
            if (source !== potentialTarget &&
                !adjacencyList.get(source).has(potentialTarget)) {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex >= 0) {
            const target = stubs.splice(targetIndex, 1)[0];
            addLink(source, target);
            if (source < target) {
                newLinks.push({ source, target });
            } else {
                newLinks.push({ source: target, target: source });
            }
        }
    }

    return newLinks;
}

export function computeMeanRandomAssortativity(nodes, originalLinks, iterations = 10) {
    let totalAssortativity = 0;

    for (let i = 0; i < iterations; i++) {
        const randomLinks = buildRandomizedLinks(nodes, originalLinks);
        const assortativity = parseFloat(computeAssortativityByRegion(nodes, randomLinks));
        totalAssortativity += assortativity;
    }

    return (totalAssortativity / iterations).toFixed(2);
}

export function computeLatencyStats(nodes) {
    // Use a Map to deduplicate measurements
    const latencyMap = new Map();
    nodes.forEach(node => {
        node.neighbors.forEach(neighbor => {
            if (neighbor.rtt) {
                const key = [node.id, neighbor.id].sort().join('-');
                latencyMap.set(key, neighbor.rtt / 2);
            }
        });
    });

    // Convert the deduplicated measurements to array
    const latencies = Array.from(latencyMap.values());

    if (latencies.length === 0) {
        return {
            min: 'N/A',
            max: 'N/A',
            avg: 'N/A',
            median: 'N/A',
            p95: 'N/A',
            total: 0,
            buckets: []
        };
    }

    latencies.sort((a, b) => a - b);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const median = latencies[Math.floor(latencies.length / 2)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    const bucketDefinitions = [
        { min: 0, max: 1, label: "<= 1 ms" },
        { min: 1, max: 10, label: "1-10 ms" },
        { min: 10, max: 50, label: "10-50 ms" },
        { min: 50, max: 100, label: "50-100 ms" },
        { min: 100, max: 200, label: "100-200 ms" },
        { min: 200, max: 500, label: "200-500 ms" },
        { min: 500, max: Infinity, label: "> 500 ms" }
    ];

    // Count latencies in each bucket
    const buckets = bucketDefinitions.map(bucket => ({
        label: bucket.label,
        count: latencies.filter(latency => latency > bucket.min && latency <= bucket.max).length
    }));

    return {
        min: min.toFixed(0),
        max: max.toFixed(0),
        avg: avg.toFixed(0),
        median: median.toFixed(0),
        p95: p95.toFixed(0),
        total: latencies.length,
        buckets
    };
}

export function computeAverageLatencyPath(nodes) {
    const adjacencyList = new Map();
    nodes.forEach(node => {
        adjacencyList.set(node.id, new Map());
    });

    // Populate adjacency list with weights (RTT/2)
    // Note: if there is not rtt, the link is not added
    nodes.forEach(node => {
        node.neighbors.forEach(neighbor => {
            if (neighbor.rtt) {
                adjacencyList.get(node.id).set(neighbor.id, neighbor.rtt / 2);
                adjacencyList.get(neighbor.id).set(node.id, neighbor.rtt / 2);
            }
        });
    });

    function dijkstra(startId) {
        const distances = new Map();
        const visited = new Set();
        const pq = []; // Priority queue

        // Initialize distances
        nodes.forEach(node => {
            distances.set(node.id, Infinity);
        });
        distances.set(startId, 0);
        pq.push([0, startId]);

        while (pq.length > 0) {
            pq.sort((a, b) => a[0] - b[0]); // Sort by distance
            const [currentDist, currentId] = pq.shift();

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const neighbors = adjacencyList.get(currentId);
            neighbors.forEach((weight, neighborId) => {
                if (!visited.has(neighborId)) {
                    const newDist = currentDist + weight;
                    if (newDist < distances.get(neighborId)) {
                        distances.set(neighborId, newDist);
                        pq.push([newDist, neighborId]);
                    }
                }
            });
        }

        return distances;
    }

    let totalLatency = 0;
    let totalPaths = 0;
    let maxLatencyPath = 0;

    // Compute shortest paths between all pairs
    nodes.forEach(node => {
        const distances = dijkstra(node.id);
        distances.forEach((distance, targetId) => {
            if (targetId !== node.id && distance !== Infinity) {
                totalLatency += distance;
                totalPaths++;
                if (distance > maxLatencyPath) {
                    maxLatencyPath = distance;
                }
            }
        });
    });

    return {
        averageLatencyPath: totalPaths > 0 ? (totalLatency / totalPaths).toFixed(0) : 'N/A',
        maxLatencyPath: maxLatencyPath > 0 ? maxLatencyPath.toFixed(0) : 'N/A'
    };
}

export class PropagationSimulator {
    constructor(startNodeId, nodes) {
        this.nodes = nodes;
        this.visited = new Set();
        this.queue = new Map();
        this.queue.set(startNodeId, 0);
        this.usedLinks = new Map();     // Track which links were used for propagation
        this.activeLinks = new Map();   // Track which links are currently active
        this.currentTime = 0;
        this.timeStep = 5;
    }

    step() {
        const newLinks = []; // Track links used in this step

        // Convert queue to array for iteration since we'll be modifying it
        Array.from(this.queue.entries()).forEach(([nodeId, timeToReach]) => {
            if (timeToReach <= this.currentTime && !this.visited.has(nodeId)) {
                this.visited.add(nodeId);
                this.queue.delete(nodeId);
                const source = this.activeLinks.get(nodeId);
                newLinks.push({
                    source,
                    target: nodeId
                });
                this.usedLinks.set(nodeId, source);
                this.activeLinks.delete(nodeId);

                const node = this.nodes.find(n => n.id === nodeId);
                if (node) {
                    node.neighbors.forEach(neighbor => {
                        if (!this.visited.has(neighbor.id)) {
                            const latency = neighbor.rtt ? neighbor.rtt / 2 : 50; // TODO: default value
                            const timeToReachNeighbor = timeToReach + latency;

                            const existingTime = this.queue.get(neighbor.id);
                            if (!existingTime || timeToReachNeighbor < existingTime) {
                                this.queue.set(neighbor.id, timeToReachNeighbor);
                                this.activeLinks.set(neighbor.id, nodeId);
                            }
                        }
                    });
                }
            }
        });

        this.currentTime += this.timeStep;
        return {
            newLinks,
            currentTime: this.currentTime,
            visitedCount: this.visited.size,
            totalNodes: this.nodes.length,
            isComplete: this.visited.size === this.nodes.length
        };
    }

    getVisitedNodes() {
        return Array.from(this.visited);
    }

    // New method to get the propagation path
    getPropagationLinks() {
        const links = [];
        this.usedLinks.forEach((source, target) => {
            links.push({
                source,
                target
            });
        });
        return links;
    }
}