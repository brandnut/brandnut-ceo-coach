# Custom Web App

A modern chat application built with React, TypeScript, and Vite, featuring enhanced Mermaid diagram rendering with multi-format export capabilities.

## Features

### Core
- **Real-time Chat**: Streaming chat interface powered by Dify.ai API
- **Conversation Management**: Create, switch, and manage multiple conversations
- **Auto-scroll**: Smart scrolling behavior during message streaming
- **Markdown Rendering**: Rich markdown support via [Streamdown](https://github.com/vercel/streamdown)

### Enhanced Mermaid Diagrams
- **Click-to-Zoom**: Modal overlay for enlarged diagram viewing
- **Multi-format Export**:
  - **MMD**: Original Mermaid source code
  - **PNG**: High-quality raster image (10x scale)
  - **JPG**: JPEG format with white background (10x scale)
- **Streamdown Integration**: Seamless enhancement without breaking default behavior

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Streamdown** - Markdown rendering with Mermaid support
- **Dify.ai API** - Chat backend

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Build

```bash
npm run build
```

Production files in `dist/`

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
custom-web-app/
├── src/
│   ├── App.tsx              # Root component with auth
│   ├── Chat.tsx             # Main chat interface
│   ├── CustomStreamdown.tsx # Enhanced Mermaid rendering
│   ├── dify.ts              # Dify.ai API integration
│   ├── main.tsx             # Entry point
│   ├── styles.css           # Global styles
│   └── markdown.scss        # Markdown-specific styles
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Configuration

### Dify.ai API
Update API credentials in `src/dify.ts`:
```typescript
const API_URL = 'https://api.dify.ai/v1'
const API_KEY = 'your-api-key-here'
```

### Tailwind CSS
Customize theme in `tailwind.config.js`

## Key Components

### CustomStreamdown
Wraps Streamdown to enhance Mermaid diagrams without affecting other markdown features:

- Injects zoom button and download dropdown via DOM manipulation
- Captures original Mermaid code by intercepting Streamdown's download button
- Renders high-quality images using Canvas API
- Uses MutationObserver to handle streaming content

### Chat
Main chat interface with:
- Conversation sidebar
- Message list with streaming support
- Input field with multi-line support
- Loading states and error handling

## Development Notes

### Mermaid Enhancement Strategy
The app uses DOM post-processing rather than component override to maintain Streamdown's default behavior:

1. Streamdown renders all markdown (including Mermaid) normally
2. `useEffect` + `MutationObserver` detect rendered Mermaid blocks
3. Custom buttons are injected into the controls div
4. Original download button is hijacked to capture source code

This approach ensures:
- Zero interference with non-Mermaid code blocks
- Full compatibility with Streamdown updates
- Clean separation of concerns

## License

ISC
