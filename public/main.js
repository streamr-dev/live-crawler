const COLORS = {
    NODE_DEFAULT: 'blue',
    HIGHLIGHT_RING: 'blue',
    NODE_INACTIVE: '#999',
    LINK_DEFAULT: '#999',
    NODE_PROPAGATION_HIGHLIGHT: 'red',
    LINK_PROPAGATION_HIGHLIGHT: 'red'
};

// Extract streamId from the URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const streamId = urlParams.get('streamId');

let currentNodeId = null;
let links = [];

function highlightConnections(startNodeId) {
    const visited = new Set();
    const queue = [startNodeId];

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

                // Highlight links and gather next level nodes
                links.forEach(linkData => {
                    if (linkData.source.id === nodeId && !visited.has(linkData.target.id)) {
                        d3.selectAll("line")
                            .filter(l => l.source.id === linkData.source.id && l.target.id === linkData.target.id)
                            .style("stroke", COLORS.LINK_PROPAGATION_HIGHLIGHT)
                            .style("stroke-width", 2)
                            .transition()
                            .duration(2000)
                            .style("stroke", COLORS.LINK_DEFAULT)
                            .style("stroke-width", 1);
                        nextQueue.push(linkData.target.id);
                    } else if (linkData.target.id === nodeId && !visited.has(linkData.source.id)) {
                        d3.selectAll("line")
                            .filter(l => l.source.id === linkData.source.id && l.target.id === linkData.target.id)
                            .style("stroke", COLORS.LINK_PROPAGATION_HIGHLIGHT)
                            .style("stroke-width", 2)
                            .transition()
                            .duration(2000)
                            .style("stroke", COLORS.LINK_DEFAULT)
                            .style("stroke-width", 1);
                        nextQueue.push(linkData.source.id);
                    }
                });
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

function showNodeDetails(node, nodeById) {
    // Update URL hash without triggering a page reload
    window.history.replaceState(null, '', `#${node.id}`);

    const detailsDiv = document.getElementById('node-details');
    const content = document.getElementById('node-details-content');
    currentNodeId = node.id;

    // Reset all nodes and links to default style first
    d3.selectAll("circle.highlight-ring").remove();
    d3.selectAll(".nodes circle").attr("fill", COLORS.NODE_DEFAULT);
    d3.selectAll(".links line")
        .attr("stroke", COLORS.LINK_DEFAULT)
        .attr("stroke-width", 1);

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
        .filter(d => d.id !== node.id && !node.neighbors.includes(d.id))
        .attr("fill", COLORS.NODE_INACTIVE);

    // Highlight links connected to the selected node
    d3.selectAll(".links line")
        .filter(d => d.source.id === node.id || d.target.id === node.id)
        .attr("stroke-width", 3);

    let detailsHTML = `
            <p><strong>Node ID:</strong> ${node.id}</p>
            <p><strong>IP Address:</strong> ${node.ipAddress || 'N/A'}</p>
            <p><strong>Location:</strong> ${(node?.location?.country || 'N/A') + '/' + (node?.location?.city || 'N/A')}</p>
            <p><strong>Region:</strong> ${node.region || 'N/A'}</p>
            <p><strong>Application version:</strong> ${node.applicationVersion}</p>
            <p><strong>Websocket URL:</strong> ${node.websocketUrl || 'N/A'}</p>
            <p><strong>Node type:</strong> ${node.nodeType}</p>
            <p><strong>Neighbors (${node.neighbors.length}):</strong><br> ${node.neighbors.map(neighborId => {
                const neighbor = nodeById.get(neighborId);
                return `<a href="#${neighborId}" style="text-decoration: none; color: blue;">${getNodeLabel(neighbor)}</a>`;
            }).join(',<br>')}</p>
            <p><strong>Control layer neighbor count:</strong> ${node.controlLayerNeighborCount}</p>
            <p><strong>All stream partitions (${node.allStreamPartitions.length}):</strong> ${node.allStreamPartitions.join(',<br>')}</p>
        `;

    content.innerHTML = detailsHTML;
    detailsDiv.style.display = 'block';
}

function closeNodeDetails() {
    // Remove hash from URL when closing details
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    document.getElementById('node-details').style.display = 'none';

    // Reset all visual elements to default state
    d3.selectAll("circle.highlight-ring").remove();
    d3.selectAll(".nodes circle").attr("fill", COLORS.NODE_DEFAULT);
    d3.selectAll(".links line")
        .attr("stroke", COLORS.LINK_DEFAULT)
        .attr("stroke-width", 1);
}

function visualizePropagation() {
    if (currentNodeId) {
        highlightConnections(currentNodeId);
    }
}

function computeNetworkStats(nodes, links) {
    const adjacencyList = new Map();

    nodes.forEach(node => {
        adjacencyList.set(node.id, []);
    });

    links.forEach(link => {
        adjacencyList.get(link.source).push(link.target);
        adjacencyList.get(link.target).push(link.source);
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

function getNodeLabel(d) {
    return d.id.substring(0, 4) + "..." + d.id.substring(d.id.length - 4) + " (" + d.ipAddress + ")" + " (" + d.location?.country + "/" + d.location?.city + ")";
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

    // Fetch topology data from localhost with streamId as a query parameter
    fetch(`/topology?streamId=${streamId}`).then(function (response) {
        return response.json()
    }).then(function (data) {
        // Remove loading indicator
        document.getElementById('loading').style.display = 'none';
        clearInterval(timerInterval);

        // Build nodes and links
        const nodes = [];
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
            d.neighbors.forEach(function (targetId) {
                const key = [sourceId, targetId].sort().join("-");
                if (!linkSet.has(key)) {
                    linkSet.add(key);
                    links.push({ source: sourceId, target: targetId });
                }
            });
        });

        // Calculate statistics for the legend
        const totalNodes = nodes.length;
        const totalConnections = links.length;
        let totalNeighborCount = 0;
        data.forEach(d => {
            totalNeighborCount += d.neighbors.length;
        });
        const averageNeighborCount = (totalNeighborCount / totalNodes).toFixed(2);
        const networkDiameter = computeNetworkDiameter(nodes, links);

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
            .attr("fill", COLORS.NODE_DEFAULT)
            .on("click", function (event, d) {
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

        // Add tooltips to display full node ID and IP address
        node.append("title")
            .text(function (d) {
                return "Node ID: " + d.id + "\nIP Address: " + (d.ipAddress ? d.ipAddress : "N/A");
            });

        // Enable dragging of nodes
        node.call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

        // Variables to keep track of highlighted nodes and links
        let highlightedNodes = new Set();
        let highlightedLinks = new Set();

        // Add click event to the SVG background to reset highlighting
        svg.on("click", function (event) {
            if (event.target === svg.node()) {
                resetHighlighting();
                closeNodeDetails();
            }
        });

        function resetHighlighting() {
            // Reset node colors
            circles.attr("fill", COLORS.NODE_DEFAULT);
            highlightedNodes.clear();

            // Reset link styles
            link.attr("stroke", COLORS.LINK_DEFAULT).attr("stroke-width", 1);
            highlightedLinks.clear();

            // Remove highlight rings
            d3.selectAll("circle.highlight-ring").remove();
        }

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

        // Add hash change listener after nodeById is created
        window.addEventListener('hashchange', () => handleHashChange(nodeById));

        // Check for initial hash
        if (window.location.hash) {
            handleHashChange(nodeById);
        }
    });
}
