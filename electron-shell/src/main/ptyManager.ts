import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as os from 'os';

const SHELL = process.env.SHELL || (os.platform() === 'win32' ? 'cmd.exe' : 'bash');

interface PtySession {
    pty: pty.IPty;
}

export class PtyManager extends EventEmitter {
    private sessions = new Map<string, PtySession>();

    // Get all active PTY session IDs
    getSessionIds(): string[] {
        return Array.from(this.sessions.keys());
    }

    create(id: string, cwd: string, cols: number, rows: number): void {
        if (this.sessions.has(id)) {
            this.kill(id);
        }

        try {
            const p = pty.spawn(SHELL, [], {
                name: 'xterm-256color',
                cols: cols || 80,
                rows: rows || 24,
                cwd,
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor',
                    BROWSER_CDP_URL: 'http://localhost:9223',
                    BROWSER_TYPE: 'internal-browser',
                } as { [key: string]: string },
            });

            p.onData((data) => {
                this.emit('data', id, data);
            });

            p.onExit(({ exitCode }) => {
                this.sessions.delete(id);
                this.emit('exit', id, exitCode);
            });

            this.sessions.set(id, { pty: p });
        } catch (error) {
            console.error(`Failed to create PTY session ${id}:`, error);
            this.emit('error', id, error);
        }
    }

    write(id: string, data: string): void {
        this.sessions.get(id)?.pty.write(data);
    }

    resize(id: string, cols: number, rows: number): void {
        this.sessions.get(id)?.pty.resize(cols, rows);
    }

    kill(id: string): void {
        const session = this.sessions.get(id);
        if (session) {
            session.pty.kill();
            this.sessions.delete(id);
        }
    }

    killAll(): void {
        for (const id of this.sessions.keys()) {
            this.kill(id);
        }
    }
}
