// Extract streamId from the URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const streamId = urlParams.get('streamId');

let currentNodeId = null;
let links = []; // Add this to store links globally

// Move highlightConnections function outside the fetch callback
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
                    .attr("fill", "red")
                    .transition()
                    .duration(2000)
                    .attr("fill", "blue");

                // Highlight links and gather next level nodes
                links.forEach(linkData => {
                    if (linkData.source.id === nodeId && !visited.has(linkData.target.id)) {
                        d3.selectAll("line")
                            .filter(l => l.source.id === linkData.source.id && l.target.id === linkData.target.id)
                            .attr("stroke", "red")
                            .attr("stroke-width", 2)
                            .transition()
                            .duration(2000)
                            .attr("stroke", "#999")
                            .attr("stroke-width", 1);
                        nextQueue.push(linkData.target.id);
                    } else if (linkData.target.id === nodeId && !visited.has(linkData.source.id)) {
                        d3.selectAll("line")
                            .filter(l => l.source.id === linkData.source.id && l.target.id === linkData.target.id)
                            .attr("stroke", "red")
                            .attr("stroke-width", 2)
                            .transition()
                            .duration(2000)
                            .attr("stroke", "#999")
                            .attr("stroke-width", 1);
                        nextQueue.push(linkData.source.id);
                    }
                });
            }
        });

        // Move to the next level
        queue.length = 0;
        queue.push(...nextQueue);

        // Schedule the next level highlighting
        setTimeout(highlightNextLevel, 600);
    }

    // Start the highlighting process
    highlightNextLevel();
}

function showNodeDetails(node, nodeById) {
    const detailsDiv = document.getElementById('node-details');
    const content = document.getElementById('node-details-content');
    currentNodeId = node.id; // Store the current node ID

    // Reset all nodes to default style
    d3.selectAll("circle.highlight-ring").remove();

    // Add highlight ring to selected node
    d3.selectAll(".nodes g")
        .filter(d => d.id === node.id)
        .append("circle")
        .attr("class", "highlight-ring")
        .attr("r", 14)
        .attr("fill", "none")
        .attr("stroke", "blue")
        .attr("stroke-width", 2);

    // Build details content
    let detailsHTML = `
            <p><strong>Node ID:</strong> ${node.id}</p>
            <p><strong>IP Address:</strong> ${node.ipAddress || 'N/A'}</p>
            <p><strong>Location:</strong> ${(node?.location?.country || 'N/A') + '/' + (node?.location?.city || 'N/A')}</p>
            <p><strong>Region:</strong> ${node.region || 'N/A'}</p>
            <p><strong>Application version:</strong> ${node.applicationVersion}</p>
            <p><strong>Websocket URL:</strong> ${node.websocketUrl || 'N/A'}</p>
            <p><strong>Node type:</strong> ${node.nodeType}</p>
            <p><strong>Neighbors (${node.neighbors.length}):</strong><br> ${node.neighbors.map(neighborId => getNodeLabel(nodeById.get(neighborId))).join(',<br>')}</p>
            <p><strong>Control layer neighbor count:</strong> ${node.controlLayerNeighborCount}</p>
            <p><strong>All stream partitions (${node.allStreamPartitions.length}):</strong> ${node.allStreamPartitions.join(',<br>')}</p>
        `;

    content.innerHTML = detailsHTML;
    detailsDiv.style.display = 'block';
}

function closeNodeDetails() {
    document.getElementById('node-details').style.display = 'none';
    // Remove highlight ring when closing details
    d3.selectAll("circle.highlight-ring").remove();
}

function visualizePropagation() {
    if (currentNodeId) {
        highlightConnections(currentNodeId);
    }
}

function computeNetworkDiameter(nodes, links) {
    const adjacencyList = new Map();

    // Build adjacency list
    nodes.forEach(node => {
        adjacencyList.set(node.id, []);
    });

    links.forEach(link => {
        adjacencyList.get(link.source).push(link.target);
        adjacencyList.get(link.target).push(link.source);
    });

    let diameter = 0;

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
        distances.forEach(distance => {
            if (distance > diameter) {
                diameter = distance;
            }
        });
    });

    return diameter;
}

function getNodeLabel(d) {
    return d.id.substring(0, 4) + "..." + d.id.substring(d.id.length - 4) + " (" + d.ipAddress + ")" + " (" + d.location?.country + "/" + d.location?.city + ")";
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
        const margin = { right: 200 }; // Space for legend
        const width = window.innerWidth - margin.right;
        const height = window.innerHeight;

        // Define zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', zoomed);

        // Create the SVG and apply zoom behavior
        const svg = d3.select("body")
            .append("svg")
            .attr("width", width + margin.right)
            .attr("height", height)
            .call(zoom);

        // Update SVG size on window resize
        window.addEventListener('resize', function() {
            const newWidth = window.innerWidth - margin.right;
            const newHeight = window.innerHeight;

            svg
                .attr("width", newWidth + margin.right)
                .attr("height", newHeight);

            // Update force center
            simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));

            // Update legend position
            legend.attr("transform", `translate(${newWidth + 20}, 50)`);

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
            .attr("fill", "blue")
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

        // Function to reset highlighting
        function resetHighlighting() {
            // Reset node colors
            circles.attr("fill", "blue");
            highlightedNodes.clear();

            // Reset link styles
            link.attr("stroke", "#999").attr("stroke-width", 1);
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

        // Drag event handlers
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

        // Add legend to the right side
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 20}, 50)`);

        legend.append("text")
            .text("Network Statistics")
            .attr("font-size", "16px")
            .attr("font-weight", "bold");

        legend.append("text")
            .attr("dy", "1.5em")
            .text("Total Nodes: " + totalNodes);

        legend.append("text")
            .attr("dy", "3em")
            .text("Total Connections: " + totalConnections);

        legend.append("text")
            .attr("dy", "4.5em")
            .text("Mean node degree: " + averageNeighborCount);

        legend.append("text")
            .attr("dy", "6em")
            .text("Network Diameter: " + networkDiameter);
    });
}
