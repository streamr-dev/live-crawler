const COLORS = {
    HIGHLIGHT_RING: 'blue',
    NODE_INACTIVE: '#999',
    LINK_DEFAULT: '#999',
    NODE_PROPAGATION_HIGHLIGHT: 'red',
    LINK_PROPAGATION_HIGHLIGHT: 'red'
};

const regionColorMap = {
    // Europe (Blues)
    'Northern Europe': '#1a4b82',
    'Western Europe': '#2c7bb6',
    'Eastern Europe': '#2171b5',
    'Southern Europe': '#6baed6',

    // Asia (Greens)
    'Eastern Asia': '#1a9850',
    'Central Asia': '#66bd63',
    'Western Asia': '#a6d96a',
    'Southern Asia': '#d9ef8b',
    'South-eastern Asia': '#91cf60',

    // Americas (Purples)
    'Northern America': '#762a83',
    'Latin America and the Caribbean': '#9970ab',

    // Africa (Oranges/Reds)
    'Northern Africa': '#d73027',
    'Sub-Saharan Africa': '#fc8d59',

    // Oceania (Teals)
    'Australia and New Zealand': '#018571',
    'Melanesia': '#80cdc1',
    'Micronesia': '#35978f',
    'Polynesia': '#c7eae5',

    // Unknown regions
    'Unknown': '#999999'
};

// Extract streamId from the URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const streamId = urlParams.get('streamId');

let links = [];
let nodes = [];
let currentNodeId = null;
let colorScale = d3.scaleOrdinal()
    .domain(Object.keys(regionColorMap))
    .range(Object.values(regionColorMap));

function toggleSection(section) {
    section.classList.toggle('collapsed');
}

function showNodeDetails(node, nodeById) {

    // Update URL hash without triggering a page reload
    window.history.replaceState(null, '', `#${node.id}`);

    const detailsDiv = document.getElementById('node-details');
    const content = document.getElementById('node-details-content');
    currentNodeId = node.id;

    resetHighlighting();

    // Add highlight ring to selected node
    d3.selectAll(".nodes g")
        .filter(d => d.id === node.id)
        .append("circle")
        .attr("class", "highlight-ring")
        .attr("r", 14)
        .attr("fill", "none")
        .attr("stroke", COLORS.HIGHLIGHT_RING)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,4");

    d3.selectAll(".nodes circle")
        .filter(d => d.id !== node.id && !node.neighbors.some(n => n.id === d.id))
        .attr("fill", COLORS.NODE_INACTIVE);

    // Highlight links connected to the selected node
    d3.selectAll(".links line")
        .filter(d => d.source.id === node.id || d.target.id === node.id)
        .attr("stroke-width", 3);

    let detailsHTML = `
            <p><strong>Node ID:</strong> ${node.id}</p>
            <p><strong>IP Address:</strong> ${node.ipAddress || 'N/A'}</p>
            <p><strong>Location:</strong> ${node?.location?.country || 'N/A'}${node?.location?.city ? ' / ' + node.location.city : ''}</p>
            <p><strong>Region:</strong> ${node.region || 'N/A'}</p>
            <p><strong>Application version:</strong> ${node.applicationVersion}</p>
            <p><strong>Websocket URL:</strong> ${node.websocketUrl || 'N/A'}</p>
            <p><strong>Node type:</strong> ${node.nodeType}</p>
            <p><strong>Neighbors (${node.neighbors.length}):</strong><br> ${node.neighbors.map(neighbor => {
                const neighborNode = nodeById.get(neighbor.id);
                const rttDisplay = neighbor.rtt ? `(${(neighbor.rtt / 2).toFixed(0)} ms)` : '';
                return `<a href="#${neighbor.id}" style="text-decoration: none; color: blue;">${getNodeLabel(neighborNode)}</a> ${rttDisplay}`;
            }).join(',<br>')}</p>
            <p><strong>Control layer neighbor count:</strong> ${node.controlLayerNeighborCount}</p>
            <p><strong>All stream partitions (${node.allStreamPartitions.length}):</strong> ${node.allStreamPartitions.join(',<br>')}</p>
        `;

    content.innerHTML = detailsHTML;
    detailsDiv.style.display = 'block';
}

function closeNodeDetails() {
    resetHighlighting();

    // Remove hash from URL when closing details
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    document.getElementById('node-details').style.display = 'none';
}

function visualizePropagation() {
    if (!currentNodeId) {
        return;
    }
    const visited = new Set();
    const queue = [currentNodeId];

    function highlightNextLevel() {
        if (queue.length === 0) return;

        const nextQueue = [];
        queue.forEach(nodeId => {
            if (!visited.has(nodeId)) {
                visited.add(nodeId);

                // Highlight the node
                d3.selectAll("circle")
                    .filter(n => n.id === nodeId)
                    .each(function() {
                        const originalColor = d3.select(this).attr("fill");
                        d3.select(this)
                            .attr("fill", COLORS.NODE_PROPAGATION_HIGHLIGHT)
                            .transition()
                            .duration(2000)
                            .attr("fill", originalColor);
                    });

                // Find the node's neighbors
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    node.neighbors.forEach(neighbor => {
                        if (!visited.has(neighbor.id)) {
                            // Highlight the link
                            d3.selectAll("line")
                                .filter(l =>
                                    (l.source.id === nodeId && l.target.id === neighbor.id) ||
                                    (l.source.id === neighbor.id && l.target.id === nodeId)
                                )
                                .style("stroke", COLORS.LINK_PROPAGATION_HIGHLIGHT)
                                .style("stroke-width", 2)
                                .transition()
                                .duration(2000)
                                .style("stroke", COLORS.LINK_DEFAULT)
                                .style("stroke-width", 1);
                            nextQueue.push(neighbor.id);
                        }
                    });
                }
            }
        });

        // Move to the next level
        queue.length = 0;
        queue.push(...nextQueue);

        // Schedule the next level highlighting
        setTimeout(highlightNextLevel, 2000);
    }

    highlightNextLevel();
}

function computeNetworkStats(nodes, links) {
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

function computeNodeStats(nodes) {
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

function getNodeLabel(d) {
    const idPart = d.id.substring(0, 4) + "..." + d.id.substring(d.id.length - 4);
    const ipPart = d.ipAddress ? ` (${d.ipAddress})` : '';

    let locationPart = '';
    if (d.location) {
        const locationBits = [];
        if (d.location.countryCode) {
            locationBits.push(d.location.countryCode);
        }
        if (d.location.city) {
            locationBits.push(d.location.city);
        }
        if (locationBits.length > 0) {
            locationPart = ` (${locationBits.join('/')})`;
        }
    }

    return idPart + ipPart + locationPart;
}

function handleHashChange(nodeById) {
    const nodeId = window.location.hash.slice(1); // Remove the # from the hash
    if (nodeId && nodeById.has(nodeId)) {
        const node = nodeById.get(nodeId);
        showNodeDetails(node, nodeById);
    } else {
        closeNodeDetails();
    }
}

function resetHighlighting() {
    // Reset node colors to their region colors
    d3.selectAll("circle")
        .attr("fill", d => d.location?.subRegion ? colorScale(d.location.subRegion) : regionColorMap['Unknown']);

    // Reset link styles
    d3.selectAll(".links line")
        .attr("stroke", COLORS.LINK_DEFAULT)
        .attr("stroke-width", 1);

    // Remove highlight rings
    d3.selectAll("circle.highlight-ring").remove();
}

function computeAssortativityByRegion(nodes, links) {
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
function buildAssortativityByRegionMaximizedLinks(nodes, originalLinks) {
    const regionGroups = new Map();
    const nodeDegrees = new Map();
    const adjacencyList = new Map();

    // Initialize node degrees and adjacency list
    nodes.forEach(node => {
        nodeDegrees.set(node.id, 0);
        adjacencyList.set(node.id, new Set());
        const region = node.location.subRegion || 'Unknown';
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
function buildRandomizedLinks(nodes, originalLinks) {
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

function computeMeanRandomAssortativity(nodes, originalLinks, iterations = 10) {
    let totalAssortativity = 0;

    for (let i = 0; i < iterations; i++) {
        const randomLinks = buildRandomizedLinks(nodes, originalLinks);
        const assortativity = parseFloat(computeAssortativityByRegion(nodes, randomLinks));
        totalAssortativity += assortativity;
    }

    return (totalAssortativity / iterations).toFixed(2);
}

function computeLatencyStats(nodes) {
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

if (!streamId) {
    // Show instructions if no streamId is provided
    document.getElementById('loading').style.display = 'none';
    document.getElementById('instructions').style.display = 'block';
} else {
    // Timer for loading screen
    let secondsElapsed = 0;
    const timerElement = document.getElementById('timer');
    const timerInterval = setInterval(() => {
        secondsElapsed++;
        timerElement.textContent = secondsElapsed;
    }, 1000);

    // Get partition from URL if it exists
    const partition = urlParams.get('partition');

    // Build the URL with optional partition parameter
    let topologyUrl = `/topology?streamId=${streamId}`;
    if (partition !== null) {
        topologyUrl += `&partition=${partition}`;
    }

    fetch(topologyUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        // Remove loading indicator
        document.getElementById('loading').style.display = 'none';
        clearInterval(timerInterval);

        // Show the legend
        document.getElementById('legend').style.display = 'block';

        // Update the global nodes array instead of creating a new one
        nodes = [];
        const nodeById = new Map();
        data.forEach(function (d) {
            const node = {
                id: d.id,
                ipAddress: d.ipAddress,
                location: d.location,
                region: d.region,
                applicationVersion: d.applicationVersion,
                websocketUrl: d.websocketUrl,
                nodeType: d.nodeType,
                neighbors: d.neighbors,
                controlLayerNeighborCount: d.controlLayerNeighborCount,
                allStreamPartitions: d.allStreamPartitions,
            };
            nodes.push(node);
            nodeById.set(d.id, node);
        });

        // Update the global links array instead of creating a new one
        links = [];
        const linkSet = new Set();
        data.forEach(function (d) {
            const sourceId = d.id;
            d.neighbors.forEach(function (neighbor) {
                const targetId = neighbor.id;
                const key = [sourceId, targetId].sort().join("-");
                if (!linkSet.has(key)) {
                    linkSet.add(key);
                    links.push({ source: sourceId, target: targetId });
                }
            });
        });

        // Uncomment below to visualize optimal links
        //links = buildOptimalLinks(nodes, links);

        // Calculate statistics for the legend
        const totalNodes = nodes.length;
        const totalConnections = links.length;
        let totalNeighborCount = 0;
        data.forEach(d => {
            totalNeighborCount += d.neighbors.length;
        });
        const averageNeighborCount = (totalNeighborCount / totalNodes).toFixed(2);
        const stats = computeNetworkStats(nodes, links);
        const networkDiameter = stats.diameter;
        const averagePathLength = stats.averagePathLength;

        // Calculate assortativity by sub-region
        const assortativityByRegion = computeAssortativityByRegion(nodes, links);

        // Compute theoretical maximum assortativity by region
        const optimalLinks = buildAssortativityByRegionMaximizedLinks(nodes, links);
        const maxAssortativity = computeAssortativityByRegion(nodes, optimalLinks);

        // Compute random assortativity
        const randomAssortativity = computeMeanRandomAssortativity(nodes, links);

        // Set up the SVG canvas dimensions responsively
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Define zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', zoomed);

        // Create the SVG and apply zoom behavior
        const svg = d3.select("body")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(zoom);

        // Update SVG size on window resize
        window.addEventListener('resize', function() {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;

            svg
                .attr("width", newWidth)
                .attr("height", newHeight);

            // Update force center
            simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));

            simulation.alpha(0.3).restart();
        });

        // Create a container for all graph elements
        const container = svg.append("g");

        // Initialize the simulation
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(function (d) { return d.id; }).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        // Draw links (edges)
        const link = container.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("stroke-width", 1);

        // Draw nodes
        const node = container.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes)
            .enter().append("g");

        const circles = node.append("circle")
            .attr("r", 10)
            .attr("fill", function(d) {
                return d.location?.subRegion ? colorScale(d.location.subRegion) : regionColorMap['Unknown'];
            })
            .on("click", function(event, d) {
                event.stopPropagation();
                showNodeDetails(d, nodeById);
            });

        // Add labels to nodes
        const labels = node.append("text")
            .attr("dy", -15)
            .text(function (d) {
                return getNodeLabel(d);
            })
            .attr("font-size", "10px")
            .attr("text-anchor", "middle");

        // Enable dragging of nodes
        node.call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

        // Add click event to the SVG background to reset highlighting
        svg.on("click", function (event) {
            if (event.target === svg.node()) {
                closeNodeDetails();
            }
        });

        // Update positions on each tick of the simulation
        simulation.on("tick", () => {
            link
                .attr("x1", function (d) { return d.source.x; })
                .attr("y1", function (d) { return d.source.y; })
                .attr("x2", function (d) { return d.target.x; })
                .attr("y2", function (d) { return d.target.y; });

            node
                .attr("transform", function (d) {
                    return "translate(" + d.x + "," + d.y + ")";
                });
        });

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;

            // Stop propagation to prevent zooming while dragging
            event.sourceEvent.stopPropagation();
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Function to handle zooming and panning
        function zoomed(event) {
            container.attr("transform", event.transform);
        }

        // Update the HTML legend with statistics
        document.getElementById('total-nodes').textContent = totalNodes;
        document.getElementById('total-connections').textContent = totalConnections;
        document.getElementById('mean-degree').textContent = averageNeighborCount;
        document.getElementById('network-diameter').textContent = networkDiameter;
        document.getElementById('average-path-length').textContent = averagePathLength;
        document.getElementById('assortativity-by-region').textContent = assortativityByRegion;
        document.getElementById('max-assortativity').textContent = maxAssortativity;
        document.getElementById('random-assortativity').textContent = randomAssortativity;

        // Add hash change listener after nodeById is created
        window.addEventListener('hashchange', () => handleHashChange(nodeById));

        // Check for initial hash
        if (window.location.hash) {
            handleHashChange(nodeById);
        }

        const nodeStats = computeNodeStats(nodes);

        // Update subRegion statistics
        const subRegionStatsHtml = nodeStats.subRegions
            .map(([subRegion, count]) => {
                const color = subRegion === 'Unknown' ? regionColorMap['Unknown'] : colorScale(subRegion);
                return `<p>
                    <span class="color-dot" style="background-color: ${color}"></span>
                    ${subRegion}: ${count} (${((count/totalNodes)*100).toFixed(1)}%)
                </p>`;
            })
            .join('\n');
        document.getElementById('region-stats').innerHTML = subRegionStatsHtml;

        // Update version statistics
        const versionStatsHtml = `
            <table class="stats-table">
                <tr>
                    <th>Version</th>
                    <th>Count</th>
                    <th>%</th>
                </tr>
                ${nodeStats.versions
                    .map(([version, count]) => `
                        <tr>
                            <td>${version}</td>
                            <td>${count}</td>
                            <td>${((count/totalNodes)*100).toFixed(1)}%</td>
                        </tr>`
                    ).join('\n')}
            </table>
        `;
        document.getElementById('version-stats').innerHTML = versionStatsHtml;

        // After computing other statistics
        const latencyStats = computeLatencyStats(nodes);
        const latencyStatsHtml = `
            <div style="margin-top: 10px;">
                <table class="stats-table">
                    <tr>
                        <th>Range</th>
                        <th>Count</th>
                        <th>%</th>
                    </tr>
                    ${latencyStats.buckets.map(bucket =>
                        `<tr>
                            <td>${bucket.label}</td>
                            <td>${bucket.count}</td>
                            <td>${((bucket.count/latencyStats.total)*100).toFixed(1)}%</td>
                        </tr>`
                    ).join('\n')}
                    <tr>
                        <td><strong>Total:</strong></td>
                        <td><strong>${latencyStats.total}</strong></td>
                        <td><strong>100%</strong></td>
                    </tr>
                </table>
                <p style="margin-top: 10px;"><strong>Key statistics:</strong></p>
                <p>Average: ${latencyStats.avg} ms</p>
                <p>Median: ${latencyStats.median} ms</p>
                <p>95th percentile: ${latencyStats.p95} ms</p>
                <p>Min: ${latencyStats.min}</p>
                <p>Max: ${latencyStats.max}</p>
            </div>
        `;
        document.getElementById('latency-stats').innerHTML = latencyStatsHtml;
    });
}
