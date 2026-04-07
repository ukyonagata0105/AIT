import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // PTY operations
    ptyCreate: (args: { id: string; cwd: string; cols: number; rows: number; shell?: string; shellArgs?: string[] }) =>
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
    workspacesSave: (workspaces: unknown[]) => ipcRenderer.invoke('workspaces:save', workspaces),
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
    tmuxIsAvailable: () => ipcRenderer.invoke('tmux:isAvailable'),

    // Shell operations
    shellOpenExternal: (filePath: string) => ipcRenderer.invoke('shell:openExternal', filePath),
    shellShowContextMenu: (filePath: string, isDir: boolean) => ipcRenderer.invoke('shell:showContextMenu', filePath, isDir),

    // Search operations
    searchGrep: (options: { path: string; pattern: string; args: string[]; signal?: AbortSignal }) =>
        ipcRenderer.invoke('search:grep', options),
    searchFiles: (options: { path: string; pattern: string }) =>
        ipcRenderer.invoke('search:files', options),
    searchRipgrep: (options: { path: string; pattern: string; args: string[] }) =>
        ipcRenderer.invoke('search:ripgrep', options),

    // State sync for web mode
    stateUpdate: (state: any) => ipcRenderer.send('state:update', state),
});
