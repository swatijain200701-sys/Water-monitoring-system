const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.static('public')); // Serve the dashboard UI
app.use(express.static(__dirname)); // FALLBACK: If GitHub accidentally flattened the folders, serve from root too
app.use(express.json());

// --- System State & Algorithm Setup ---
let systemState = {
    isRunning: false,
    simulationMode: 'normal', // 'normal', 'leakage', 'high'
    flowRate: 0,              // L/min
    tankLevel: 85,            // Percentage
    dailyConsumption: 42.5,   // Liters
    continuousFlowTime: 0,    // Seconds
    valveOpen: true,          // true / false
    waterSaved: 0,            // Liters
    alertState: { type: 'safe', title: 'Standby', description: 'System ready.' }
};

const LEAK_THRESHOLD_TIME = 15;
const HIGH_USAGE_LIMIT = 500;
const UPDATE_INTERVAL = 2000;

let lastUpdateTime = Date.now();
let simulationInterval;

// --- REST API for Real Hardware (e.g. ESP32, Arduino) ---
// When deployed, physical devices can POST to this endpoint
app.post('/api/telemetry', (req, res) => {
    const { flowRate, valveStatus, deviceId } = req.body;
    
    // Process incoming live telemetry
    if (flowRate !== undefined) systemState.flowRate = flowRate;
    if (valveStatus !== undefined) systemState.valveOpen = valveStatus;
    
    // Evaluate logic constraints and trigger dashboard update
    io.emit('systemUpdate', systemState);
    
    // Reply to microcontroller with actionable commands
    res.json({ 
        success: true, 
        message: "Telemetry received", 
        command: systemState.valveOpen ? 'OPEN' : 'CLOSE' 
    });
});

// --- WebSockets for Live Dashboard Delivery ---
io.on('connection', (socket) => {
    console.log('New dashboard client connected:', socket.id);
    
    // Dispatch initial state upon connection
    socket.emit('systemUpdate', systemState);
    
    // Listen for Demo Commands from the Dashboard
    socket.on('startEngine', () => {
        startSimulation();
    });
    
    socket.on('stopEngine', () => {
        stopSimulation();
    });
    
    socket.on('setMode', (mode) => {
        systemState.simulationMode = mode;
        if (mode === 'leakage') {
            // Fast-forward continuous flow timer for demo purposes
            systemState.continuousFlowTime = LEAK_THRESHOLD_TIME - 3;
        }
        if (!systemState.isRunning) startSimulation();
        io.emit('systemUpdate', systemState);
    });
    
    socket.on('toggleValve', () => {
        systemState.valveOpen = !systemState.valveOpen;
        if (!systemState.valveOpen) {
            systemState.flowRate = 0;
            systemState.alertState = { type: 'warning', title: 'Manual Override', description: 'Valve manually closed.' };
        } else {
            systemState.alertState = { type: 'safe', title: 'Manual Override', description: 'Valve manually opened.' };
        }
        io.emit('systemUpdate', systemState);
    });
    
    socket.on('resetSystem', () => {
        stopSimulation();
        systemState = {
            isRunning: false,
            simulationMode: 'normal',
            flowRate: 0,
            tankLevel: 85,
            dailyConsumption: 42.5,
            continuousFlowTime: 0,
            valveOpen: true,
            waterSaved: 0,
            alertState: { type: 'safe', title: 'System Reset', description: 'All parameters restored to default.' }
        };
        io.emit('systemUpdate', systemState);
        io.emit('resetChart'); // Signal the UI to clear the line chart canvas
    });

    socket.on('disconnect', () => {
        console.log('Dashboard client disconnected:', socket.id);
    });
});

// --- Backend Simulation / Time-Series Algorithm ---
function startSimulation() {
    if (systemState.isRunning) return;
    systemState.isRunning = true;
    systemState.alertState = { type: 'safe', title: 'Monitoring started', description: 'System backend active.' };
    lastUpdateTime = Date.now();
    io.emit('systemUpdate', systemState);
    
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = setInterval(updateLoop, UPDATE_INTERVAL);
}

function stopSimulation() {
    systemState.isRunning = false;
    systemState.flowRate = 0;
    systemState.alertState = { type: 'safe', title: 'Demo Paused', description: 'System Backend halted.' };
    clearInterval(simulationInterval);
    io.emit('systemUpdate', systemState);
}

function updateLoop() {
    const now = Date.now();
    const deltaTimeSeconds = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;

    // 1. Simulating logic: This replaces the raw hardware reading if physical device is unattached
    if (!systemState.valveOpen) {
        systemState.flowRate = 0;
    } else {
        let baseFlow = 0;
        if (systemState.simulationMode === 'normal') {
            // Normal usage: intermittent water usage
            if (Math.random() > 0.6) baseFlow = 4 + (Math.random() * 3);
            else baseFlow = 0;
        } else if (systemState.simulationMode === 'leakage') {
            // Leakage logic simulation
            baseFlow = 12 + (Math.random() * 2);
        } else if (systemState.simulationMode === 'high') {
            // Heavy usage logic simulation
            baseFlow = 25 + (Math.random() * 5);
        } else if (systemState.simulationMode === 'eco') {
            // Slow trickle usage simulation
            baseFlow = 1.0 + (Math.random() * 1.5);
        }
        systemState.flowRate = parseFloat(baseFlow.toFixed(1));
    }

    // 2. Core Time-Series Logic Evaluation
    if (systemState.flowRate > 0) {
        const volumeAdded = (systemState.flowRate / 60) * deltaTimeSeconds;
        systemState.dailyConsumption += volumeAdded;
        systemState.continuousFlowTime += deltaTimeSeconds;
        systemState.tankLevel = Math.max(0, systemState.tankLevel - (volumeAdded * 0.1));
        
        // 3. Automated Constraints
        if (systemState.continuousFlowTime >= LEAK_THRESHOLD_TIME && systemState.valveOpen) {
            systemState.valveOpen = false; // Trigger Solenoid Action
            systemState.flowRate = 0;
            systemState.alertState = { type: 'danger', title: 'LEAKAGE DETECTED', description: 'Critical continuous-flow detected. Valve auto-closed.' };
        } else if (systemState.dailyConsumption > HIGH_USAGE_LIMIT) {
            systemState.alertState = { type: 'warning', title: 'High Usage Alert', description: 'Daily consumption limit exceeded.' };
        } else if (systemState.valveOpen) {
            systemState.alertState = { type: 'safe', title: 'Monitoring', description: 'Normal flow detected.' };
        }
    } else {
        // Reset timer if flow goes to 0 (normal operation)
        systemState.continuousFlowTime = 0;
        
        if (!systemState.valveOpen && systemState.simulationMode === 'leakage') {
           // Calculate efficiency of the system acting autonomously
           systemState.waterSaved += (12 / 60) * deltaTimeSeconds; 
        } else if (systemState.valveOpen) {
            systemState.alertState = { type: 'safe', title: 'Standby', description: 'System ready.' };
        }
    }

    // Send payload to UI
    io.emit('systemUpdate', systemState);
}

// Ensure the platform binds to dynamically provided ports (Essential for Render/Heroku Deployment)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Backend server successfully running on port ${PORT}`);
    // Start simulation immediately so dashboard feels alive upon load
    startSimulation();
});
