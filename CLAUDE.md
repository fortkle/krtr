# krtr

Screenshot and image annotation tool built with Electron + React + TypeScript.

## Development

```bash
npm install
npm run dev        # Start dev server
npm run build      # Production build
npm run typecheck  # Type check all
```

## Architecture

- **Main process** (`src/main/`): App lifecycle, tray, global shortcuts, screen capture, IPC
- **Preload** (`src/preload/`): contextBridge IPC bridge between Main and Renderer
- **Renderer** (`src/renderer/`): React UI for region selection overlay
- **Shared** (`src/shared/`): Types and constants shared between processes

## Key Shortcuts

- `Cmd+Shift+5`: Region selection capture
- `Cmd+Shift+6`: Full screen capture

## Conventions

- electron-vite for build tooling
- `@electron-toolkit/tsconfig` for TypeScript configs
- Tray-resident app (no dock icon on macOS)
- Screenshots saved to Desktop + clipboard
