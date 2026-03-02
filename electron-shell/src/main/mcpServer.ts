import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserWindow, ipcMain } from "electron";
import express = require("express");

export class PlaywrightAltMcp {
    private app: express.Application;

    constructor() {
        this.app = express();
    }

    private getMainWindow(): BrowserWindow | null {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? windows[0] : null;
    }

    private async sendToRendererAndWait<T>(
        channel: string,
        resultChannel: string,
        data?: any,
        timeout: number = 15000
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const mainWindow = this.getMainWindow();
            if (!mainWindow || mainWindow.isDestroyed()) {
                reject(new Error("No main window available"));
                return;
            }

            const timeoutId = setTimeout(() => {
                ipcMain.removeListener(resultChannel, handler);
                reject(new Error(`Timeout waiting for ${resultChannel}`));
            }, timeout);

            const handler = (_event: any, result: T) => {
                clearTimeout(timeoutId);
                ipcMain.removeListener(resultChannel, handler);
                resolve(result);
            };

            ipcMain.on(resultChannel, handler);
            mainWindow.webContents.send(channel, data);
        });
    }

    async run() {
        this.app.use(express.json());

        // Stateless StreamableHTTP endpoint - creates a new server per request
        this.app.all("/mcp", async (req, res) => {
            const server = new Server(
                { name: "playwright-alt", version: "0.3.0" },
                { capabilities: { tools: {} } }
            );

            server.setRequestHandler(ListToolsRequestSchema, async () => ({
                tools: [
                    {
                        name: "browser_navigate",
                        description: "IDE内蔵ブラウザパネルで指定URLに移動する（Electronのwebviewを操作）",
                        inputSchema: {
                            type: "object",
                            properties: { url: { type: "string", description: "URL to navigate to" } },
                            required: ["url"],
                        },
                    },
                    {
                        name: "browser_screenshot",
                        description: "IDE内蔵ブラウザのスクリーンショットを取得する",
                        inputSchema: { type: "object", properties: {} },
                    },
                    {
                        name: "browser_click",
                        description: "IDE内蔵ブラウザ内の要素をクリックする",
                        inputSchema: {
                            type: "object",
                            properties: { selector: { type: "string" } },
                            required: ["selector"],
                        },
                    },
                    {
                        name: "browser_get_dom",
                        description: "IDE内蔵ブラウザの現在ページのDOMを取得する",
                        inputSchema: { type: "object", properties: {} },
                    },
                ],
            }));

            server.setRequestHandler(CallToolRequestSchema, async (request) => {
                const mainWindow = this.getMainWindow();
                if (!mainWindow || mainWindow.isDestroyed()) {
                    return {
                        content: [{ type: "text", text: "❌ エラー: メインウィンドウが見つかりません" }]
                    };
                }

                switch (request.params.name) {
                    case "browser_navigate": {
                        const { url } = request.params.arguments as { url: string };
                        try {
                            // Send navigate command to renderer
                            mainWindow.webContents.send('browser:doNavigate', url);
                            // Wait a bit for navigation to start
                            await new Promise(r => setTimeout(r, 500));
                            console.error(`[playwright-alt] Navigate to: ${url}`);
                            return { content: [{ type: "text", text: `✅ IDE内蔵ブラウザで ${url} を開きました` }] };
                        } catch (e: any) {
                            return { content: [{ type: "text", text: `❌ ナビゲーションエラー: ${e.message}` }] };
                        }
                    }
                    case "browser_screenshot": {
                        try {
                            const result = await this.sendToRendererAndWait<{ ok: boolean; data?: string; error?: string }>(
                                'browser:doScreenshot',
                                'browser:screenshotResult',
                                undefined,
                                15000
                            );
                            if (result.ok && result.data) {
                                return {
                                    content: [
                                        { type: "text", text: "✅ スクリーンショットを取得しました" },
                                        { type: "text", text: result.data },
                                    ],
                                };
                            } else {
                                return { content: [{ type: "text", text: `❌ スクリーンショットエラー: ${result.error}` }] };
                            }
                        } catch (e: any) {
                            return { content: [{ type: "text", text: `❌ スクリーンショットエラー: ${e.message}` }] };
                        }
                    }
                    case "browser_click": {
                        const { selector } = request.params.arguments as { selector: string };
                        try {
                            const result = await this.sendToRendererAndWait<{ ok: boolean; error?: string }>(
                                'browser:doClick',
                                'browser:clickResult',
                                selector,
                                10000
                            );
                            if (result.ok) {
                                return { content: [{ type: "text", text: `✅ "${selector}" をクリックしました` }] };
                            } else {
                                return { content: [{ type: "text", text: `❌ クリックエラー: ${result.error}` }] };
                            }
                        } catch (e: any) {
                            return { content: [{ type: "text", text: `❌ クリックエラー: ${e.message}` }] };
                        }
                    }
                    case "browser_get_dom": {
                        try {
                            const result = await this.sendToRendererAndWait<{ ok: boolean; data?: string; error?: string }>(
                                'browser:doGetDom',
                                'browser:domResult',
                                undefined,
                                10000
                            );
                            if (result.ok && result.data) {
                                return { content: [{ type: "text", text: result.data.slice(0, 8000) }] };
                            } else {
                                return { content: [{ type: "text", text: `❌ DOM取得エラー: ${result.error}` }] };
                            }
                        } catch (e: any) {
                            return { content: [{ type: "text", text: `❌ DOM取得エラー: ${e.message}` }] };
                        }
                    }
                    default:
                        throw new Error(`Unknown tool: ${request.params.name}`);
                }
            });

            // Use stateless mode (no session management needed)
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined, // stateless
            });

            res.on("close", () => server.close());

            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        });

        this.app.listen(3333, () => {
            console.error("[playwright-alt] MCP server on http://localhost:3333/mcp (IPC mode)");
        });
    }
}
