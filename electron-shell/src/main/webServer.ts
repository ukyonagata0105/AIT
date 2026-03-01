import express from 'express';
import * as http from 'http';
import * as path from 'path';
import * as os from 'os';
import { PtyManager } from './ptyManager';

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

        // Auto-attach to existing PTY if any (for sharing with Electron)
        const existingSessions = pty.getSessionIds();
        if (existingSessions.length > 0) {
            currentPtyId = existingSessions[0];
            isSharedSession = true;
            console.log(`[WebServer] Auto-attaching to existing shared PTY: ${currentPtyId}`);
            ws.send(JSON.stringify({ type: 'attached', id: currentPtyId }));
        }

        pty.on('data', dataHandler);
        pty.on('exit', exitHandler);

        ws.on('message', (message: string) => {
            try {
                const msg = JSON.parse(message);

                switch (msg.type) {
                    case 'create':
                        currentPtyId = msg.id;
                        pty.create(msg.id, msg.cwd, msg.cols || 80, msg.rows || 24);
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
                }
            } catch (e) {
                console.error('[WebServer] Error processing message:', e);
            }
        });

        ws.on('close', () => {
            console.log('[WebServer] Client disconnected');
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
