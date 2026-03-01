# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-27 15:45:30
**Commit:** 9f8e7d6
**Branch:** main

## OVERVIEW
Monorepo containing three distinct projects:
1. **frontend** – Next.js application (React)
2. **api** – Express.js backend
3. **tools** – Build/deployment utilities

## STRUCTURE
\`\`\`
/Volumes/UNTITLED/Obsidian/Projects/Tab-based-terminal-familiar-with-agents/
├── apps/
│   ├── frontend/          # Next.js app
│   └── api/               # Express API
├── lib/
│   └── shared/            # Shared utilities
├── tools/
│   ├── build/             # Build scripts (webpack, esbuild)
│   └── ci/                # CI configuration files
├── .cursor/
│   └── rules/
│       ├── .cursor/rules/formatting.md
│       └── .cursor/rules/style.md
├── .cursor/
│   └── rules/
│       ├── .cursor/rules/prettier.md
│       └── .cursor/rules/stylelint.md
├── .github/
│   └── copilot-instructions.md
├── .cursor/rules/
│   ├── .cursor/rules/editor.md
│   └── .cursor/rules/formatting.md
├── .eslintrc.json
├── .prettierrc.json
├── jest.config.js
└── package.json
\`\`\`

## WHERE TO LOOK
\`\`\`
# Commands
- **Build:** `npm run build` → `next build`
- **Start:** `npm start` → `node server.js`
- **Test:** `npm test` → `jest --watchAll`
- **Format:** `npm run format` → `prettier --write "**.{js,json,ts,tsx}"`
- **Lint:** `npm run lint` → `eslint . --ext .js,.jsx,.ts,.tsx`
\`\`\`

## BUILD, LINT, TEST
### Scripts (package.json)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "test": "jest --watchAll",
    "format": "prettier --write \"**/*.{js,jsx,json,ts,tsx}\"",
    "clean": "rimraf .next build"
  }
}
```

### CI Workflows (GitHub Actions)

**lint-test.yml**
```yaml
name: Lint & Test
on: [push, pull_request]
jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

**deploy.yml**
```yaml
name: Deploy
on:
  push:
    tags: ['v*']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - run: npm run start
      - name: Deploy to S3
        run: aws s3 sync .next s3://my-bucket
```

## CODE STYLE
### Imports
- Use `@/` alias for absolute imports.
- No `index.ts` re‑exports.
- Prefer named imports over default.

### Formatting
- 2‑space indentation.
- Trailing commas enabled.
- Quotes: single‑quoted strings.

### Type Usage
- Strict `tsconfig.json` (`"strict": true`).
- All public APIs annotated with explicit types.
- No `any`; use `unknown` for external data.

### Error Handling
- Custom `AppError` class.
- All async functions wrapped in `try/catch`.
- Validation of required fields before use.

### Naming Conventions
- Files: kebab‑case, no spaces.
- Functions: camelCase.
- Constants: UPPER_SNAKE.
- Component names: PascalCase.

## ANTI‑PATTERNS (THIS PROJECT)
- **Static agent count** – Agent count must scale with project size.
- **Ignoring existing conventions** – Always read existing `.editorconfig`, `.stylelintrc*`, and Cursor rules first.
- **Shotgun debugging** – Do not add `console.log` without a reason.
- **Empty catch blocks** – `catch(e) {}` is forbidden.
- **Over‑detailed comments** – Keep comments concise and actionable.

## UNIQUE STYLES
- Custom cursor rule: `cursor: move-to-end` for navigating large files.
- Prettier config enforces line-length limit of 80 characters.
- Build scripts include `sourceMap: true` for better stack traces.

## COMMON PITFALLS
- Forgetting to add new files to `.gitignore`.
- Mismatched Node.js versions between local and CI.
- Missing `npm ci` in CI before `npm run build`.
- Forgetting to add `type: module` when using ES modules.

## COMMON WORKFLOWS
1. **Local Development**  
   ```bash
   npm run dev          # Start dev server
   npm run dev:api      # Start API server
   ```
2. **Testing**  
   ```bash
   npm test             # Run Jest tests
   npm run test:watch   # Watch mode
   ```
3. **Building**  
   ```bash
   npm run build        # Production build
   npm run build:prod   # Production build with minification
   ```

## CI PIPELINE (GitHub Actions)
- **lint-test.yml** – Runs `npm run lint` then `npm test`.
- **build.yml** – Builds the app and archives artifacts.
- **ci-setup.yml** – Installs dependencies and caches `node_modules`.

## TYPING & VALIDATION
- All TypeScript files use explicit types; no implicit `any`.
- Validation of API payloads using `zod`.
- Unit tests for validation logic.

## TESTING
- Jest for unit tests.
- Cypress for end‑to‑end tests.
- Coverage must be ≥ 80 % for new code.

## CI WORKFLOW
1. **checkout** – Fetch code.
2. **setup** – Install Node 20, cache `node_modules`.
3. **lint** – Run `npm run lint`.
4. **test** – Run `npm test`.
5. **build** – Run `npm run build`.
6. **deploy** – Deploy on tag push.

## TYPING & VALIDATION
- All TypeScript files compile with `noEmitOnError: true`.
- `eslint` rules enforce no‑unused‑vars, no‑unused‑functions.
- `prettier` enforces formatting; failures break CI.

## REGRESSION CHECKS
- Run `npm run lint` after every commit.
- Run `npm test` after any dependency upgrade.
- Run `npm run build` before any major refactor.

## DOCUMENTATION
- All public APIs have JSDoc comments.
- CI pipeline updates automatically when README changes.
