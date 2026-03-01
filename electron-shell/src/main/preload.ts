import { contextBridge, ipcRenderer } from 'electron';

// Shared types
interface WorkspaceConfig {
    id: string;
    name: string;
    path: string;
    color?: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
    // PTY operations
    ptyCreate: (args: { id: string; cwd: string; cols: number; rows: number }) =>
        ipcRenderer.invoke('pty:create', args),
    ptyInput: (args: { id: string; data: string }) =>
        ipcRenderer.send('pty:input', args),
    ptyResize: (args: { id: string; cols: number; rows: number }) =>
        ipcRenderer.send('pty:resize', args),
    ptyKill: (args: { id: string }) =>
        ipcRenderer.send('pty:kill', args),
    onPtyData: (callback: (args: { id: string; data: string }) => void) => {
        ipcRenderer.on('pty:data', (_event, args) => callback(args));
    },
    onPtyExit: (callback: (args: { id: string; exitCode: number }) => void) => {
        ipcRenderer.on('pty:exit', (_event, args) => callback(args));
    },

    // Workspace operations
    workspacesLoad: () => ipcRenderer.invoke('workspaces:load'),
    workspacesSave: (workspaces: WorkspaceConfig[]) => ipcRenderer.invoke('workspaces:save', workspaces),
    workspacesAdd: () => ipcRenderer.invoke('workspaces:add'),
    workspacesRename: (id: string, name: string) => ipcRenderer.invoke('workspaces:rename', id, name),
    workspacesDelete: (id: string) => ipcRenderer.invoke('workspaces:delete', id),

    // File system
    fsReadDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
    fsReadFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),

    // Shell exec (for VS Code CLI)
    execRun: (cmd: string) => ipcRenderer.invoke('exec:run', cmd),

    // Extension Marketplace
    extSearch: (query: string) => ipcRenderer.invoke('ext:search', query),
    onExtensionInstall: (callback: (id: string) => void) => {
        ipcRenderer.on('extension:install', (_event, id) => callback(id));
    },

    // Server status
    serverGetStatus: () => ipcRenderer.invoke('server:getStatus'),

    // Shell operations
    shellOpenExternal: (filePath: string) => ipcRenderer.invoke('shell:openExternal', filePath),
    shellShowContextMenu: (filePath: string, isDir: boolean) => ipcRenderer.invoke('shell:showContextMenu', filePath, isDir),

    // Browser panel operations (for MCP)
    browserNavigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
    browserScreenshot: () => ipcRenderer.invoke('browser:screenshot'),
    browserClick: (selector: string) => ipcRenderer.invoke('browser:click', selector),
    browserGetDom: () => ipcRenderer.invoke('browser:getDom'),

    // Browser panel events (sent from main to renderer)
    onBrowserNavigate: (callback: (url: string) => void) => {
        ipcRenderer.on('browser:doNavigate', (_event, url) => callback(url));
    },
    onBrowserScreenshot: (callback: () => void) => {
        ipcRenderer.on('browser:doScreenshot', () => callback());
    },
    onBrowserClick: (callback: (selector: string) => void) => {
        ipcRenderer.on('browser:doClick', (_event, selector) => callback(selector));
    },
    onBrowserGetDom: (callback: () => void) => {
        ipcRenderer.on('browser:doGetDom', () => callback());
    },

    // Browser panel result senders (renderer -> main)
    sendScreenshotResult: (result: { ok: boolean; data?: string; error?: string }) => {
        ipcRenderer.send('browser:screenshotResult', result);
    },
    sendClickResult: (result: { ok: boolean; error?: string }) => {
        ipcRenderer.send('browser:clickResult', result);
    },
    sendDomResult: (result: { ok: boolean; data?: string; error?: string }) => {
        ipcRenderer.send('browser:domResult', result);
    }
});
