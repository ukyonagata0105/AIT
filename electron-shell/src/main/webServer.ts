import express from 'express';
import * as http from 'http';
import * as path from 'path';
import * as os from 'os';
import { PtyManager } from './infrastructure/PtyManager';

// ─── Shared State Management ─────────────────────────────────────────────────────

// Serializable terminal tab info for sync
interface SyncTerminalTab {
    id: string;
    name: string;
    ptyId: string;
    workspaceId: string;
}

interface SharedState {
    activeWorkspaceId: string | null;
    openFilePaths: string[];
    selectedFile: string | null;
    terminalTabs: SyncTerminalTab[];
    activeTerminalTabId: string | null;
}


const sharedState: SharedState = {
    activeWorkspaceId: null,
    openFilePaths: [],
    selectedFile: null,
    terminalTabs: [],
    activeTerminalTabId: null
};


const wsClients = new Set<any>();

function broadcastState() {
    const message = JSON.stringify({
        type: 'state-sync',
        state: sharedState
    });
    wsClients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(message);
        }
    });
}

export function updateSharedState(updates: Partial<SharedState>): void {
    Object.assign(sharedState, updates);
    broadcastState();
}

export function getSharedState(): SharedState {
    return { ...sharedState };
}

// ─── PTY Management ───────────────────────────────────────────────────────────────

// Shared PTY manager - set from main process
let sharedPtyManager: PtyManager | null = null;

export function setSharedPtyManager(pm: PtyManager): void {
    sharedPtyManager = pm;
}

function getPtyManager(): PtyManager {
    return sharedPtyManager || new PtyManager();
}

export function startWebServer(port: number = 4096): void {
    const app = express();
    const server = http.createServer(app);

    // CORS headers for web mode
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    });

    // Serve static files from dist/renderer
    const rendererPath = path.join(__dirname, '..', 'renderer');
    app.use(express.static(rendererPath));

    // API endpoint to get workspaces
    app.get('/api/workspaces', (req, res) => {
        const configPath = path.join(os.homedir(), '.ai-terminal-ide', 'workspaces.json');
        try {
            const fs = require('fs');
            if (fs.existsSync(configPath)) {
                const workspaces = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                res.json(workspaces);
            } else {
                res.json([]);
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to load workspaces' });
        }
    });

    // API endpoint to save workspaces
    app.post('/api/workspaces', express.json(), (req, res) => {
        const configPath = path.join(os.homedir(), '.ai-terminal-ide', 'workspaces.json');
        try {
            const fs = require('fs');
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: 'Failed to save workspaces' });
        }
    });

    // API endpoint to read directory
    app.get('/api/fs/readDir', (req, res) => {
        const dirPath = req.query.path as string;
        if (!dirPath) {
            res.status(400).json({ error: 'Path required' });
            return;
        }
        try {
            const fs = require('fs');
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            const result = entries.map((e: any) => {
                let mtime = 0, size = 0;
                try {
                    const stat = fs.statSync(path.join(dirPath, e.name));
                    mtime = stat.mtimeMs;
                    size = stat.size;
                } catch { }
                return { name: e.name, isDir: e.isDirectory(), mtime, size };
            });
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: 'Failed to read directory' });
        }
    });

    // API endpoint to read file
    app.get('/api/fs/readFile', (req, res) => {
        const filePath = req.query.path as string;
        if (!filePath) {
            res.status(400).json({ error: 'Path required' });
            return;
        }
        try {
            const fs = require('fs');
            const content = fs.readFileSync(filePath, 'utf8');
            res.send(content);
        } catch (e) {
            res.status(500).json({ error: 'Failed to read file' });
        }
    });

    // API endpoint to get active PTY sessions (for web sharing)
    app.get('/api/pty/list', (req, res) => {
        const pty = getPtyManager();
        const activeIds = pty.getSessionIds();
        res.json({ sessions: activeIds });
    });

    // SPA fallback - serve index.html for all routes
    app.use((req, res) => {
        res.sendFile(path.join(rendererPath, 'index.html'));
    });

    // WebSocket for PTY communication
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws: any) => {
        console.log('[WebServer] Client connected');

        let currentPtyId: string | null = null;
        let isSharedSession = false;

        // Forward PTY data to client
        const dataHandler = (id: string, data: string) => {
            if (id === currentPtyId) {
                ws.send(JSON.stringify({ type: 'data', id, data }));
            }
        };

        const exitHandler = (id: string, exitCode: number) => {
            if (id === currentPtyId) {
                ws.send(JSON.stringify({ type: 'exit', id, exitCode }));
            }
        };

        const pty = getPtyManager();

        // Track this client for broadcasting
        wsClients.add(ws);

        // Send current state to new client
        ws.send(JSON.stringify({
            type: 'state-sync',
            state: sharedState
        }));

        // Auto-attach to existing PTY if any (sync with Electron)
        const existingSessions = pty.getSessionIds();
        if (existingSessions.length > 0) {
            currentPtyId = existingSessions[0];
            isSharedSession = true;
            console.log(`[WebServer] Auto-syncing with existing PTY: ${currentPtyId}`);
            ws.send(JSON.stringify({ type: 'sync', ptyId: currentPtyId, sessions: existingSessions }));
        }

        pty.on('data', dataHandler);
        pty.on('exit', exitHandler);
        ws.on('message', (message: string) => {
            try {
                const msg = JSON.parse(message);

                switch (msg.type) {
                    case 'create':
                        currentPtyId = msg.id;
                        isSharedSession = false;  // Web-created PTY, kill on disconnect
                        pty.create({
                            id: msg.id,
                            cwd: msg.cwd,
                            cols: msg.cols || 80,
                            rows: msg.rows || 24,
                            shell: msg.shell,
                            shellArgs: msg.shellArgs,
                        });
                        console.log(`[WebServer] Created remote PTY: ${msg.id}`);
                        break;
                    case 'watch':
                        // Watch existing PTY (attach to Electron's PTY)
                        currentPtyId = msg.id;
                        isSharedSession = true;
                        console.log(`[WebServer] Client watching shared PTY: ${msg.id}`);
                        break;
                    case 'input':
                        if (msg.id) {
                            pty.write(msg.id, msg.data);
                        }
                        break;
                    case 'resize':
                        if (msg.id) {
                            pty.resize(msg.id, msg.cols, msg.rows);
                        }
                        break;
                    case 'kill':
                        if (msg.id) {
                            pty.kill(msg.id);
                        }
                        break;
                    case 'state-update':
                        // Client is updating shared state
                        updateSharedState(msg.state || {});
                        console.log('[WebServer] State updated:', msg.state);
                        break;
                }
            } catch (e) {
                console.error('[WebServer] Error processing message:', e);
            }
        });

        ws.on('close', () => {
            console.log('[WebServer] Client disconnected');
            wsClients.delete(ws);
            pty.off('data', dataHandler);
            pty.off('exit', exitHandler);
            if (currentPtyId && !isSharedSession) {
                console.log(`[WebServer] Killing web-created PTY: ${currentPtyId}`);
                pty.kill(currentPtyId);
            } else if (currentPtyId && isSharedSession) {
                console.log(`[WebServer] Client detached from shared PTY: ${currentPtyId} (keeping PTY alive)`);
            }
        });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[WebServer] Port ${port} is already in use. Web server not started.`);
            console.error(`[WebServer] Kill the existing process with: lsof -ti:${port} | xargs kill`);
        } else {
            console.error('[WebServer] Server error:', err.message);
        }
    });

    server.listen(port, '0.0.0.0', () => {
        const networkInterfaces = os.networkInterfaces();
        const addresses: string[] = [];

        Object.values(networkInterfaces).forEach((interfaces) => {
            interfaces?.forEach((iface) => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    addresses.push(iface.address);
                }
            });
        });

        console.log(`\n[WebServer] 🚀 AI Terminal IDE Web Server running!`);
        console.log(`[WebServer] Local:   http://localhost:${port}`);
        addresses.forEach(addr => {
            console.log(`[WebServer] Network: http://${addr}:${port}`);
        });
        console.log(`[WebServer]\n[WebServer] Access from other devices on the same network.`);
        console.log(`[WebServer] For Tailscale users, use your Tailscale IP.\n`);
    });
}
