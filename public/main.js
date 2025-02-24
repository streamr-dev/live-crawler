import {
    computeNetworkStats,
    computeNodeStats,
    computeLatencyStats,
    computeAssortativityByRegion,
    buildAssortativityByRegionMaximizedLinks,
    computeMeanRandomAssortativity,
    computeAverageLatencyPath,
    PropagationSimulator
} from './stats.js';

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

window.toggleSection = function(section) {
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

window.closeNodeDetails = function () {
    resetHighlighting();

    // Remove hash from URL when closing details
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    document.getElementById('node-details').style.display = 'none';
}

window.visualizePropagation = function () {
    if (!currentNodeId) {
        return;
    }

    // Create container for timer and controls
    const container = d3.select("body")
        .append("div")
        .attr("class", "propagation-timer")
        .style("position", "fixed")
        .style("top", "20px")
        .style("left", "20px")
        .style("background", "white")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("border", "1px solid #ccc")
        .style("font-family", "sans-serif");

    // Add timer display div
    const timerDisplay = container
        .append("div")
        .attr("class", "timer-text");

    // Add pause/continue button
    const pauseButton = container
        .append("button")
        .style("margin-top", "8px")
        .style("padding", "4px 8px")
        .text("Pause");

    const simulator = new PropagationSimulator(currentNodeId, nodes);
    let isPaused = false;
    let animationFrame = null;
    const animationSpeed = 500;

    function updateTimerDisplay(time, visitedCount, totalNodes) {
        const percentage = Math.round((visitedCount / totalNodes) * 100);
        timerDisplay.html(`Time: ${time}ms<br>Nodes reached: ${visitedCount} / ${totalNodes} (${percentage}%)`);
    }

    function highlightNodes(nodeIds) {
        nodeIds.forEach(nodeId => {
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

            // Find and highlight links to previously visited nodes
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
                node.neighbors.forEach(neighbor => {
                    if (simulator.getVisitedNodes().includes(neighbor.id)) {
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
                    }
                });
            }
        });
    }

    function step() {
        if (isPaused) {
            return;
        }

        const result = simulator.step();

        if (result.newNodes.length > 0) {
            highlightNodes(result.newNodes);
        }

        updateTimerDisplay(result.currentTime, result.visitedCount, result.totalNodes);

        if (!result.isComplete) {
            animationFrame = setTimeout(step, animationSpeed);
        } else {
            setTimeout(() => {
                container.remove();
            }, 2000);
        }
    }

    // Initial display
    updateTimerDisplay(0, 0, nodes.length);

    // Add pause/continue functionality
    pauseButton.on("click", () => {
        isPaused = !isPaused;
        pauseButton.text(isPaused ? "Continue" : "Pause");
        if (!isPaused) {
            step();
        }
    });

    step();
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

        // Calculate latency path statistics
        const latencyPathStats = computeAverageLatencyPath(nodes);

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
        document.getElementById('average-latency-path').textContent = latencyPathStats.averageLatencyPath;
        document.getElementById('max-latency-path').textContent = latencyPathStats.maxLatencyPath;
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
