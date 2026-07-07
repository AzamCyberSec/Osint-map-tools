const defaultNodeStyle = {
    font: { 
        color: '#ffffff', 
        size: 18, 
        face: 'Outfit', 
        bold: { color: '#ffffff', size: 18, mod: 'bold' }
    },
    borderWidth: 2,
    borderWidthSelected: 4,
    shadow: { enabled: true, color: 'rgba(56, 189, 248, 0.4)', size: 20, x: 0, y: 5 },
    shapeProperties: { borderRadius: 12 }, 
    margin: { top: 12, right: 20, bottom: 12, left: 20 }
};

let savedNodes = localStorage.getItem('roadmap_nodes');
let savedEdges = localStorage.getItem('roadmap_edges');
let savedCounter = localStorage.getItem('roadmap_counter');

let initialNodes = savedNodes ? JSON.parse(savedNodes) : [
    { 
        id: 1, label: '🎯 Main Target', shape: 'box', 
        color: { 
            background: '#1e293b', 
            border: '#38bdf8',
            highlight: { background: '#0ea5e9', border: '#ffffff' }
        }, 
        nodeType: 'text', x: 0, y: -100, ...defaultNodeStyle,
        shadow: { enabled: true, color: 'rgba(56, 189, 248, 0.8)', size: 30, x: 0, y: 5 }
    }
];

let initialEdges = savedEdges ? JSON.parse(savedEdges) : [];
let nodeIdCounter = savedCounter ? parseInt(savedCounter) : 2;

let nodes = new vis.DataSet(initialNodes);
let edges = new vis.DataSet(initialEdges);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'click') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.03);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.03);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.03);
    } else if (type === 'connect') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'delete') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'drag') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(80, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime); 
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.02);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.02);
    }
}

let undoStack = [];
let redoStack = [];
let isRestoringHistory = false;
const MAX_HISTORY = 30;

function getCleanState() {
    let exportNodes = nodes.get().map(n => {
        let copy = { ...n };
        if (copy.originalColor) { copy.color = copy.originalColor; delete copy.originalColor; }
        if (copy.originalShadow) { copy.shadow = copy.originalShadow; delete copy.originalShadow; }
        return copy;
    });
    
    let exportEdges = edges.get().map(e => {
        let copy = { ...e };
        if (copy.originalWidth !== undefined && copy.originalWidth !== null) { 
            copy.width = copy.originalWidth; 
            delete copy.originalWidth; 
            copy.color = { color: '#f43f5e', highlight: '#fb7185', hover: '#fb7185' };
        }
        return copy;
    });
    
    if (typeof network !== 'undefined') {
        let positions = network.getPositions();
        exportNodes.forEach(n => {
            if (positions[n.id]) {
                n.x = positions[n.id].x;
                n.y = positions[n.id].y;
            }
        });
    }

    return { nodes: exportNodes, edges: exportEdges, counter: nodeIdCounter };
}

function captureHistory() {
    if (isRestoringHistory) return;
    let currentState = getCleanState();
    if (undoStack.length === 0 || JSON.stringify(undoStack[undoStack.length - 1]) !== JSON.stringify(currentState)) {
        undoStack.push(currentState);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack = [];
        updateUndoRedoUI();
    }
}

function updateUndoRedoUI() {
    let undoBtn = document.getElementById('undoBtn');
    let redoBtn = document.getElementById('redoBtn');
    if(undoBtn) undoBtn.disabled = undoStack.length === 0;
    if(redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function undo() {
    if (undoStack.length === 0) return;
    playSound('click');
    redoStack.push(getCleanState());
    applyState(undoStack.pop());
}

function redo() {
    if (redoStack.length === 0) return;
    playSound('click');
    undoStack.push(getCleanState());
    applyState(redoStack.pop());
}

function applyState(state) {
    isRestoringHistory = true;
    nodes.clear();
    edges.clear();
    nodes.add(state.nodes);
    edges.add(state.edges);
    nodeIdCounter = state.counter;
    saveToLocalStorage();
    updateUndoRedoUI();
    isRestoringHistory = false;
}

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault();
        redo();
    }
});

function saveToLocalStorage() {
    if (isRestoringHistory) return;
    let state = getCleanState();
    localStorage.setItem('roadmap_nodes', JSON.stringify(state.nodes));
    localStorage.setItem('roadmap_edges', JSON.stringify(state.edges));
    localStorage.setItem('roadmap_counter', state.counter.toString());
}

nodes.on('*', saveToLocalStorage);
edges.on('*', saveToLocalStorage);
let container = document.getElementById('mynetwork');
let data = { nodes: nodes, edges: edges };

let options = {
    interaction: { 
        hover: true, 
        keyboard: true, 
        dragNodes: true, 
        multiselect: true,
        tooltipDelay: 200
    },
    manipulation: { enabled: false }, 
    nodes: { fixed: false },
    edges: {
        width: 3,
        color: { color: '#f43f5e', highlight: '#fb7185', hover: '#fb7185' },
        arrows: { to: { enabled: true, scaleFactor: 0.7, type: 'arrow' } },
        smooth: {
            type: 'cubicBezier',
            forceDirection: 'none',
            roundness: 0.4
        },
        shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 10, x: 0, y: 3 }
    },
    physics: { 
        enabled: false
    }
};

let network = new vis.Network(container, data, options);

network.on("dragStart", function(params) {
    if (params.nodes && params.nodes.length > 0) {
        captureHistory();
    }
});

let lastDragSoundTime = 0;
network.on("dragging", function(params) {
    if (params.nodes && params.nodes.length > 0) {
        let now = Date.now();
        if (now - lastDragSoundTime > 60) {
            playSound('drag');
            lastDragSoundTime = now;
        }
    }
});

network.on("dragEnd", function (params) {
    if (params.nodes && params.nodes.length > 0) {
        let positions = network.getPositions(params.nodes);
        let updates = params.nodes.map(nodeId => {
            return { id: nodeId, x: positions[nodeId].x, y: positions[nodeId].y };
        });
        nodes.update(updates);
    }
});

function forceSave() {
    let btn = document.getElementById('saveBtn');
    let originalText = btn.innerHTML;
    
    let allPositions = network.getPositions();
    let updates = [];
    nodes.get().forEach(n => {
        if (allPositions[n.id]) {
            updates.push({ id: n.id, x: allPositions[n.id].x, y: allPositions[n.id].y });
        }
    });
    
    if (updates.length > 0) {
        nodes.update(updates);
    } else {
        saveToLocalStorage();
    }
    
    btn.innerHTML = '<span class="icon">✅</span> Saved';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    playSound('success');
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.color = '';
        btn.style.borderColor = '';
    }, 2000);
}

window.addEventListener("beforeunload", function (e) {
    let confirmationMessage = "Are you sure you want to leave? Make sure your changes are saved.";
    e.returnValue = confirmationMessage;
    return confirmationMessage;
});

function clearAllData() {
    if (confirm("Are you sure you want to clear all data and reset the roadmap? This action cannot be undone!")) {
        captureHistory();
        localStorage.removeItem('roadmap_nodes');
        localStorage.removeItem('roadmap_edges');
        localStorage.removeItem('roadmap_counter');
        
        nodes.clear();
        edges.clear();
        
        nodeIdCounter = 2;
        
        nodes.add({ 
            id: 1, label: '🎯 Main Target', shape: 'box', 
            color: { 
                background: '#1e293b', 
                border: '#38bdf8',
                highlight: { background: '#0ea5e9', border: '#ffffff' }
            }, 
            nodeType: 'text', x: 0, y: -100, ...defaultNodeStyle,
            shadow: { enabled: true, color: 'rgba(56, 189, 248, 0.8)', size: 30, x: 0, y: 5 }
        });
        
        if (firstSelectedNode !== null) {
            firstSelectedNode = null;
        }
        network.unselectAll();
        playSound('delete');
    }
}

let firstSelectedNode = null;

network.on("hoverNode", function (params) {
    if (firstSelectedNode !== null) return;
    let nodeId = params.node;

    let connectedNodesList = network.getConnectedNodes(nodeId);
    let connectedEdgesList = network.getConnectedEdges(nodeId);
    let nUpdates = [];
    
    let mainNode = nodes.get(nodeId);
    if (!mainNode.originalColor) {
        nUpdates.push({
            id: nodeId,
            originalColor: mainNode.color,
            originalShadow: mainNode.shadow,
            color: { border: '#ffffff', background: '#38bdf8' }, 
            shadow: { enabled: true, color: 'rgba(56, 189, 248, 0.9)', size: 30, x: 0, y: 0 }
        });
    }

    connectedNodesList.forEach(nId => {
        let n = nodes.get(nId);
        if (!n.originalColor) {
            nUpdates.push({
                id: nId,
                originalColor: n.color,
                originalShadow: n.shadow,
                color: { border: '#38bdf8', background: n.color?.background || '#1e293b' },
                shadow: { enabled: true, color: 'rgba(56, 189, 248, 0.6)', size: 20, x: 0, y: 0 }
            });
        }
    });
    if (nUpdates.length > 0) nodes.update(nUpdates);

    let eUpdates = [];
    connectedEdgesList.forEach(eId => {
        let e = edges.get(eId);
        if (e.originalWidth === undefined || e.originalWidth === null) {
            eUpdates.push({
                id: eId,
                originalWidth: e.width || 3,
                color: { color: '#38bdf8' },
                width: 5
            });
        }
    });
    if (eUpdates.length > 0) edges.update(eUpdates);
});

network.on("blurNode", function (params) {
    if (firstSelectedNode !== null) return;
    restoreHoverEffects();
});

function restoreHoverEffects() {
    let nUpdates = [];
    nodes.get().forEach(n => {
        if (n.originalColor) {
            nUpdates.push({
                id: n.id,
                color: n.originalColor,
                shadow: n.originalShadow,
                originalColor: null, originalShadow: null
            });
        }
    });
    if (nUpdates.length > 0) nodes.update(nUpdates);

    let eUpdates = [];
    edges.get().forEach(e => {
        if (e.originalWidth !== undefined && e.originalWidth !== null) {
            eUpdates.push({
                id: e.id,
                color: { color: '#f43f5e', highlight: '#fb7185', hover: '#fb7185' },
                width: e.originalWidth,
                originalWidth: null
            });
        }
    });
    if (eUpdates.length > 0) edges.update(eUpdates);
}

network.on("click", function (params) {
    hideContextMenu();
    
    if (params.nodes.length === 1) {
        let clickedNodeId = params.nodes[0];
        
        if (firstSelectedNode === null) {
            restoreHoverEffects();
            firstSelectedNode = clickedNodeId;
            
            let node = nodes.get(clickedNodeId);
            nodes.update({
                id: clickedNodeId,
                originalColor: node.color,
                originalShadow: node.shadow,
                color: { border: '#ffffff', background: '#10b981' },
                shadow: { enabled: true, color: 'rgba(16, 185, 129, 0.9)', size: 30, x: 0, y: 0 }
            });
            
        } else {
            if (firstSelectedNode !== clickedNodeId) {
                let edgeExists = edges.get().some(e => e.from === firstSelectedNode && e.to === clickedNodeId);
                if (!edgeExists) {
                    captureHistory();
                    edges.add({ from: firstSelectedNode, to: clickedNodeId });
                    playSound('connect');
                }
            }
            resetFirstNode();
            network.unselectAll();
        }
    } else {
        if (firstSelectedNode !== null) resetFirstNode();
    }
});

function resetFirstNode() {
    if (firstSelectedNode !== null) {
        let node = nodes.get(firstSelectedNode);
        if (node && node.originalColor) {
            nodes.update({
                id: firstSelectedNode,
                color: node.originalColor,
                shadow: node.originalShadow,
                originalColor: null, originalShadow: null
            });
        }
        firstSelectedNode = null;
    }
}

const contextMenu = document.getElementById('contextMenu');
const nodeMenuItems = document.getElementById('nodeMenuItems');
const menuAddText = document.getElementById('menuAddText');
const menuAddImage = document.getElementById('menuAddImage');
const menuEdit = document.getElementById('menuEdit');
const menuUploadImage = document.getElementById('menuUploadImage');
const menuColor = document.getElementById('menuColor');
const menuSize = document.getElementById('menuSize');
const menuDelete = document.getElementById('menuDelete');

let selectedElement = { type: null, id: null };
let rightClickPosition = { x: 0, y: 0 };

const imageUploadInput = document.getElementById('imageUpload');
const colorPicker = document.getElementById('colorPicker');

network.on("oncontext", function (params) {
    params.event.preventDefault(); 
    
    if (firstSelectedNode !== null) resetFirstNode();
    
    let nodeId = network.getNodeAt(params.pointer.DOM);
    let edgeId = network.getEdgeAt(params.pointer.DOM);
    
    rightClickPosition = params.pointer.canvas;

    if (nodeId) {
        selectedElement = { type: 'node', id: nodeId };
        network.selectNodes([nodeId]);
        
        let node = nodes.get(nodeId);
        menuAddText.style.display = 'none';
        menuAddImage.style.display = 'none';
        menuColor.style.display = 'flex';
        menuSize.style.display = 'flex';
        menuDelete.style.display = 'flex';
        
        if (node.nodeType === 'image') {
            menuEdit.style.display = 'none';
            menuUploadImage.style.display = 'flex';
        } else {
            menuEdit.style.display = 'flex';
            menuUploadImage.style.display = 'none';
        }
        
        showMenu(params.pointer.DOM.x, params.pointer.DOM.y);
    } else if (edgeId) {
        selectedElement = { type: 'edge', id: edgeId };
        network.selectEdges([edgeId]);
        
        menuAddText.style.display = 'none';
        menuAddImage.style.display = 'none';
        menuEdit.style.display = 'none';
        menuUploadImage.style.display = 'none';
        menuColor.style.display = 'none';
        menuSize.style.display = 'none';
        menuDelete.style.display = 'flex';
        
        showMenu(params.pointer.DOM.x, params.pointer.DOM.y);
    } else {
        selectedElement = { type: null, id: null };
        network.unselectAll();
        
        menuAddText.style.display = 'flex';
        menuAddImage.style.display = 'flex';
        menuEdit.style.display = 'none';
        menuUploadImage.style.display = 'none';
        menuColor.style.display = 'none';
        menuSize.style.display = 'none';
        menuDelete.style.display = 'none';
        
        showMenu(params.pointer.DOM.x, params.pointer.DOM.y);
    }
});

function showMenu(x, y) {
    contextMenu.style.display = 'block';
    
    const menuWidth = contextMenu.offsetWidth || 180;
    const menuHeight = contextMenu.offsetHeight || 120;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    if (x + menuWidth > windowWidth) x = windowWidth - menuWidth - 10;
    if (y + menuHeight > windowHeight) y = windowHeight - menuHeight - 10;
    
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
}

function hideContextMenu() {
    contextMenu.style.display = 'none';
}

const editModalOverlay = document.getElementById('editModalOverlay');
const nodeTextInput = document.getElementById('nodeTextInput');

document.getElementById('menuEdit').addEventListener('click', function() {
    hideContextMenu();
    if(selectedElement.type === 'node') {
        let node = nodes.get(selectedElement.id);
        if (node.nodeType === 'text') {
            nodeTextInput.value = node.label;
            editModalOverlay.style.display = 'flex';
            setTimeout(() => {
                nodeTextInput.focus();
                nodeTextInput.select();
            }, 100);
        }
    }
});

document.getElementById('menuUploadImage').addEventListener('click', function() {
    hideContextMenu();
    if(selectedElement.type === 'node') {
        imageUploadInput.click(); 
    }
});

function closeEditModal() {
    editModalOverlay.style.display = 'none';
    selectedElement = { type: null, id: null };
}

function addCustomNode(type) {
    captureHistory();
    let newNode = { 
        id: nodeIdCounter, 
        x: rightClickPosition.x, 
        y: rightClickPosition.y, 
        ...defaultNodeStyle
    };

    if (type === 'text') {
        newNode.label = "New Block";
        newNode.shape = 'box';
        newNode.color = { background: '#1e293b', border: '#38bdf8', highlight: { background: '#0ea5e9', border: '#ffffff' } };
        newNode.nodeType = 'text';
    } else if (type === 'image') {
        newNode.shape = 'circularImage';
        newNode.image = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%231e293b"/%3E%3Ctext x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23f8fafc"%3EImage%3C/text%3E%3C/svg%3E'; 
        newNode.size = 40;
        newNode.color = { background: '#1e293b', border: '#38bdf8', highlight: { background: '#0ea5e9', border: '#ffffff' } };
        newNode.nodeType = 'image';
    }

    nodes.add(newNode);
    playSound('click');
    
    if (type === 'text') {
        selectedElement = { type: 'node', id: nodeIdCounter };
        nodeTextInput.value = newNode.label;
        editModalOverlay.style.display = 'flex';
        setTimeout(() => {
            nodeTextInput.focus();
            nodeTextInput.select();
        }, 100);
    }

    nodeIdCounter++;
}

document.getElementById('menuAddText').addEventListener('click', function() {
    hideContextMenu();
    addCustomNode('text');
});

document.getElementById('menuAddImage').addEventListener('click', function() {
    hideContextMenu();
    addCustomNode('image');
});

function deleteNode() {
    if (selectedElement && selectedElement.type === 'node') {
        captureHistory();
        nodes.remove(selectedElement.id);
        
        let connectedEdges = network.getConnectedEdges(selectedElement.id);
        edges.remove(connectedEdges);
        playSound('delete');
    }
    hideContextMenu();
}

function saveNodeText() {
    let newText = nodeTextInput.value;
    if (newText.trim() !== "" && selectedElement.type === 'node') {
        captureHistory();
        nodes.update({ id: selectedElement.id, label: newText });
        playSound('click');
    }
    editModalOverlay.style.display = 'none';
}

function applyColor() {
    let colorValue = nodeColorInput.value;
    if (selectedElement && selectedElement.type === 'node') {
        captureHistory();
        nodes.update({ id: selectedElement.id, color: { background: colorValue, border: '#ffffff' } });
        playSound('click');
    }
    hideContextMenu();
}

nodeTextInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveNodeText();
    }
});

editModalOverlay.addEventListener('click', function(e) {
    if(e.target === editModalOverlay) {
        closeEditModal();
    }
});

const sizePanel = document.getElementById('sizePanel');
const nodeSizeInput = document.getElementById('nodeSizeInput');
const nodeSizeDisplay = document.getElementById('nodeSizeDisplay');
const closeSizePanelBtn = document.getElementById('closeSizePanel');

document.getElementById('menuSize').addEventListener('click', function() {
    hideContextMenu();
    if(selectedElement.type === 'node') {
        let node = nodes.get(selectedElement.id);
        if (node.nodeType === 'text') {
            nodeSizeInput.value = node.font?.size || 18;
            nodeSizeInput.min = 10;
            nodeSizeInput.max = 80;
            nodeSizeDisplay.innerText = nodeSizeInput.value + 'px';
        } else if (node.nodeType === 'image') {
            nodeSizeInput.value = node.size || 40;
            nodeSizeInput.min = 20;
            nodeSizeInput.max = 200;
            nodeSizeDisplay.innerText = nodeSizeInput.value + 'px';
        }
        sizePanel.style.display = 'block';
    }
});

function closeSizePanel() {
    sizePanel.style.display = 'none';
}

closeSizePanelBtn.addEventListener('click', closeSizePanel);

nodeSizeInput.addEventListener('mousedown', function(e) {
    captureHistory();
});

nodeSizeInput.addEventListener('input', function(e) {
    if (selectedElement.type === 'node') {
        let val = parseInt(e.target.value);
        nodeSizeDisplay.innerText = val + 'px';
        let node = nodes.get(selectedElement.id);
        let newEdgeWidth = 3;
        
        if (node.nodeType === 'text') {
            let newFont = Object.assign({}, node.font || defaultNodeStyle.font);
            newFont.size = val;
            if (newFont.bold) {
                newFont.bold = Object.assign({}, newFont.bold);
                newFont.bold.size = val;
            }
            nodes.update({ id: selectedElement.id, font: newFont });
            newEdgeWidth = Math.max(3, val / 6);
        } else if (node.nodeType === 'image') {
            nodes.update({ id: selectedElement.id, size: val });
            newEdgeWidth = Math.max(3, val / 12);
        }
        
        let connectedEdges = network.getConnectedEdges(selectedElement.id);
        if (connectedEdges.length > 0) {
            let edgeUpdates = connectedEdges.map(edgeId => {
                return { id: edgeId, width: newEdgeWidth };
            });
            edges.update(edgeUpdates);
        }
    }
});

nodeSizeInput.addEventListener('mouseup', function(e) {
    playSound('click');
});

network.on("click", function(params) {
    if (params.nodes.length === 0 && params.edges.length === 0) {
        closeSizePanel();
    }
});

document.getElementById('menuColor').addEventListener('click', function() {
    hideContextMenu();
    if(selectedElement.type === 'node') colorPicker.click(); 
});

colorPicker.addEventListener('input', function(e) {
    if(selectedElement.type === 'node') {
        nodes.update({ 
            id: selectedElement.id, 
            color: { background: e.target.value, border: '#ffffff' } 
        });
    }
});

document.getElementById('menuDelete').addEventListener('click', function() {
    hideContextMenu();
    if(selectedElement.type === 'node') {
        deleteNode();
    } else if (selectedElement.type === 'edge') {
        captureHistory();
        edges.remove(selectedElement.id); 
        playSound('delete');
    }
});

imageUploadInput.addEventListener('change', function(event) {
    let file = event.target.files[0];
    if (file && selectedElement.type === 'node') {
        let reader = new FileReader();
        reader.onload = function(e) {
            captureHistory();
            nodes.update({ 
                id: selectedElement.id, 
                image: e.target.result, 
                label: "", 
                shape: 'circularImage' 
            });
            playSound('click');
            imageUploadInput.value = ""; 
        };
        reader.readAsDataURL(file);
    }
});

function createBackgroundCanvas(callback) {
    let networkCanvas = document.querySelector("#mynetwork canvas");
    let newCanvas = document.createElement("canvas");
    newCanvas.width = networkCanvas.width;
    newCanvas.height = networkCanvas.height;
    
    let ctx = newCanvas.getContext("2d");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    ctx.drawImage(networkCanvas, 0, 0);
    callback(newCanvas);
}

function exportToPNG() {
    createBackgroundCanvas(function(canvas) {
        let link = document.createElement('a'); 
        link.href = canvas.toDataURL("image/png"); 
        link.download = 'Roadmap_Pro.png'; 
        link.click();
    });
}

function exportToPDF() {
    createBackgroundCanvas(function(canvas) {
        window.jsPDF = window.jspdf.jsPDF; 
        let doc = new jsPDF({ orientation: 'landscape' });
        let pdfWidth = doc.internal.pageSize.getWidth();
        let pdfHeight = doc.internal.pageSize.getHeight();
        let imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        doc.addImage(canvas.toDataURL("image/jpeg", 1.0), 'JPEG', 0, 0, pdfWidth, imgHeight);
        doc.save("Roadmap_Pro.pdf");
    });
}