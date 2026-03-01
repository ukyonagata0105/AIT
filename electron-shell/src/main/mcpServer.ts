import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, Browser, BrowserContext } from "playwright-core";
import express from "express";

const CDP_URL = "http://localhost:9223";

let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;

async function ensureConnected() {
    if (browser) return;
    try {
        browser = await chromium.connectOverCDP(CDP_URL);
        browserContext = browser.contexts()[0];
        console.error("[playwright-alt] Connected to Electron CDP");
    } catch (e) {
        console.error("[playwright-alt] CDP connection failed:", e);
        throw e;
    }
}

export class PlaywrightAltMcp {
    private app: express.Application;

    constructor() {
        this.app = express();
    }

    async run() {
        this.app.use(express.json());

        // Stateless StreamableHTTP endpoint - creates a new server per request
        this.app.all("/mcp", async (req, res) => {
            const server = new Server(
                { name: "playwright-alt", version: "0.2.0" },
                { capabilities: { tools: {} } }
            );

            server.setRequestHandler(ListToolsRequestSchema, async () => ({
                tools: [
                    {
                        name: "browser_navigate",
                        description: "IDE内蔵ブラウザパネルで指定URLに移動する",
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
                await ensureConnected();
                const page = browserContext!.pages()[0];

                switch (request.params.name) {
                    case "browser_navigate": {
                        const { url } = request.params.arguments as { url: string };
                        await page.goto(url, { waitUntil: "domcontentloaded" });
                        return { content: [{ type: "text", text: `✅ IDE内蔵ブラウザで ${url} を開きました` }] };
                    }
                    case "browser_screenshot": {
                        const buf = await page.screenshot({ fullPage: false });
                        return {
                            content: [
                                { type: "text", text: "✅ スクリーンショットを取得しました" },
                                { type: "text", text: `data:image/png;base64,${buf.toString("base64")}` },
                            ],
                        };
                    }
                    case "browser_click": {
                        const { selector } = request.params.arguments as { selector: string };
                        await page.click(selector);
                        return { content: [{ type: "text", text: `✅ "${selector}" をクリックしました` }] };
                    }
                    case "browser_get_dom": {
                        const dom = await page.content();
                        return { content: [{ type: "text", text: dom.slice(0, 8000) }] };
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
            console.error("[playwright-alt] MCP server on http://localhost:3333/mcp");
        });
    }
}
