import express from 'express';
import * as http from 'http';
import * as path from 'path';
import * as os from 'os';
import { PtyManager } from './ptyManager';

// Default PTY manager - will be replaced with shared instance if set
let sharedPtyManager: PtyManager | null = null;

/**
 * Set the shared PTY manager from main process.
 * This allows web server to use the same PTY sessions as Electron window.
 */
export function setSharedPtyManager(pm: PtyManager): void {
    sharedPtyManager = pm;
}

function getPtyManager(): PtyManager {
    return sharedPtyManager || new PtyManager();
}

export function startWebServer(port: number = 4096): void {
    const app = express();
    const server = http.createServer(app);
    
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

    // API endpoint to get active PTY sessions (for sharing with web)
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
        let isWatcher = false;  // If true, just watching existing PTY
        
        // Auto-attach to existing PTY if any (for sharing with Electron)
        const pty = getPtyManager();
        const existingSessions = pty.getSessionIds();
        if (existingSessions.length > 0) {
            // Auto-watch the first existing PTY
            currentPtyId = existingSessions[0];
            isWatcher = true;
            console.log(`[WebServer] Auto-attaching to existing PTY: ${currentPtyId}`);
            // Send initial data about the PTY to the client
            ws.send(JSON.stringify({ type: 'attached', id: currentPtyId }));
        }
        
        // Forward PTY data to client
        const dataHandler = (id: string, data: string) => {
        const dataHandler = (id: string, data: string) => {
            // Send data if this client is watching this PTY OR if it's the owner
            if (id === currentPtyId) {
                ws.send(JSON.stringify({ type: 'data', id, data }));
            }
        };
        
        };

        pty.on('data', dataHandler);

        
        pty.on('data', dataHandler);
        pty.on('exit', exitHandler);
        
        ws.on('message', (message: string) => {
            try {
                const msg = JSON.parse(message);
                
                switch (msg.type) {
                    case 'create':
                        // Create new PTY (original behavior)
                        currentPtyId = msg.id;
                        isWatcher = false;
                        pty.create(msg.id, msg.cwd, msg.cols || 80, msg.rows || 24);
                        break;
                        
                    case 'watch':
                        // Watch existing PTY (new: attach to Electron's PTY)
                        currentPtyId = msg.id;
                        isWatcher = true;
                        console.log(`[WebServer] Client watching PTY: ${msg.id}`);
                        break;
                        
                    case 'input':
                        if (msg.id && !isWatcher) {
                            // Only allow input if not in watcher mode
                            pty.write(msg.id, msg.data);
                        }
                        break;
                        
                    case 'resize':
                        if (msg.id && !isWatcher) {
                            pty.resize(msg.id, msg.cols, msg.rows);
                        }
                        break;
                        
                    case 'kill':
                        if (msg.id && !isWatcher) {
                            pty.kill(msg.id);
                        }
                        break;
                }
            } catch (e) {
                console.error('[WebServer] Error processing message:', e);
            }
        });
        
        ws.on('close', () => {
            console.log('[WebServer] Client disconnected');
            pty.off('data', dataHandler);
            pty.off('exit', exitHandler);
            // Only kill PTY if we created it (not watching)
            if (currentPtyId && !isWatcher) {
                pty.kill(currentPtyId);
            }
        });
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
