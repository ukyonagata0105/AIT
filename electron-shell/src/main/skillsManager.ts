import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SKILLS_CONFIG_PATH = path.join(os.homedir(), '.ai-terminal-ide', 'skills.json');
const GLOBAL_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');

let isShuttingDown = false;

export function markShutdown() {
    isShuttingDown = true;
}

interface SkillConfig {
    name: string;
    description?: string;
    files: Record<string, string>;       // for .agent/skills/ (workspace-local)
    globalSkillContent?: string;         // for ~/.claude/skills/ (oh-my-opencode global)
}

interface SkillsConfig {
    autoDeployOnPtyCreate: boolean;
    skills: Record<string, SkillConfig>;
}

const PLAYWRIGHT_ALT_SKILL_CONTENT = `---
name: playwright_ALT
description: AIT IDE 内蔵ブラウザパネルを MCP 経由で操作する（browser_navigate, browser_screenshot, browser_click）
version: 1.0.0
author: ukyonagatamacstudio
mcp: playwright-alt
---

# playwright_ALT - IDE 内蔵ブラウザ操作スキル

## 重要

エージェント自身の内蔵 Playwright ツール (\`playwright_browser_navigate\` 等) は**使用しないでください**。それらは別プロセスのブラウザを起動して競合します。

## MCP ツールの使い方

MCP サーバー \`playwright-alt\` (opencode.json で登録済み) を使ってください：

- \`browser_navigate\` - IDE 内蔵ブラウザで URL を開く
- \`browser_screenshot\` - IDE 内蔵ブラウザのスクリーンショット
- \`browser_click\` - IDE 内蔵ブラウザの要素をクリック
- \`browser_get_dom\` - 現在のページの DOM を取得

動作確認: \`curl -s http://localhost:9223/json\` と \`curl -s http://localhost:3333/mcp\`
`;

const DEFAULT_SKILLS_CONFIG: SkillsConfig = {
    autoDeployOnPtyCreate: true,
    skills: {
        playwright_ALT: {
            name: 'playwright_ALT',
            description: '内蔵ブラウザパネルを制御するスキル (MCP経由)',
            globalSkillContent: PLAYWRIGHT_ALT_SKILL_CONTENT,
            files: {
                'SKILL.md': PLAYWRIGHT_ALT_SKILL_CONTENT,
            }
        }
    }
};

function ensureConfigExists(): SkillsConfig {
    const configDir = path.dirname(SKILLS_CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(SKILLS_CONFIG_PATH)) {
        fs.writeFileSync(SKILLS_CONFIG_PATH, JSON.stringify(DEFAULT_SKILLS_CONFIG, null, 2), 'utf8');
        console.log('[SkillsManager] Created default skills.json');
        return DEFAULT_SKILLS_CONFIG;
    }

    try {
        return JSON.parse(fs.readFileSync(SKILLS_CONFIG_PATH, 'utf8')) as SkillsConfig;
    } catch (e) {
        console.error('[SkillsManager] Failed to parse skills.json, using defaults:', e);
        return DEFAULT_SKILLS_CONFIG;
    }
}

/**
 * Deploys skills to the oh-my-opencode global registry at ~/.claude/skills/
 * Called once at startup so skills always appear in opencode's Skills panel.
 */
export function deployGlobalSkills(): void {
    const config = ensureConfigExists();

    for (const [skillId, skill] of Object.entries(config.skills)) {
        if (!skill.globalSkillContent) continue;

        const skillDir = path.join(GLOBAL_SKILLS_DIR, skillId);
        const skillFile = path.join(skillDir, 'SKILL.md');

        try {
            fs.mkdirSync(skillDir, { recursive: true });
            fs.writeFileSync(skillFile, skill.globalSkillContent, 'utf8');
            console.log(`[SkillsManager] Registered global skill: ${skillId}`);
        } catch (e) {
            console.error(`[SkillsManager] Failed to register global skill ${skillId}:`, e);
        }
    }
}

/**
 * Deploy all configured skills into the workspace's .agent/skills directory.
 * Called automatically when a PTY is created for a workspace.
 */
/**
 * Deploy all configured skills into the workspace's .agent/skills directory.
 * Called automatically when a PTY is created for a workspace.
 */
export function deploySkillsToWorkspace(workspacePath: string): void {
    if (isShuttingDown) return; // Early exit during shutdown to prevent EPIPE

    const config = ensureConfigExists();

    if (!config.autoDeployOnPtyCreate) {
        return;
    }

    for (const [skillId, skill] of Object.entries(config.skills)) {
        const skillDir = path.join(workspacePath, '.agent', 'skills', skillId);

        try {
            fs.mkdirSync(skillDir, { recursive: true });

            for (const [relativePath, content] of Object.entries(skill.files)) {
                const filePath = path.join(skillDir, relativePath);
                if (!fs.existsSync(filePath) || fs.statSync(filePath).size !== content.length) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    // Safe console logging - wrap in try-catch to prevent EPIPE crashes
                    try {
                        console.log(`[SkillsManager] Deployed ${skillId}/${relativePath} → ${workspacePath}`);
                    } catch (logError) {
                        // Ignore logging errors during process shutdown/crash scenarios
                    }
                }
            }
        } catch (e) {
            // Safe error logging - wrap in try-catch to prevent EPIPE crashes
            try {
                console.error(`[SkillsManager] Failed to deploy skill ${skillId}:`, e);
            } catch (logError) {
                // Ignore logging errors during process shutdown/crash scenarios
            }
        }
    }
}

export function getSkillsConfigPath(): string {
    return SKILLS_CONFIG_PATH;
}
