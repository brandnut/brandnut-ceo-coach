# Custom Web App

A modern chat application built with Next.js 15, TypeScript, and Tailwind CSS, featuring authentication, real-time streaming, and enhanced markdown rendering.

## Features

### Core
- **Next.js 15 App Router**: Modern React framework with server components
- **NextAuth.js v5**: JWT-based authentication with PostgreSQL
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

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS v3** - Utility-first styling with custom design tokens
- **NextAuth.js v5** - Authentication
- **PostgreSQL** - User database
- **Streamdown** - Markdown rendering with Mermaid support
- **Ant Design X** - UI components (Sender)
- **Dify.ai API** - Chat backend

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Dify.ai API credentials

### Installation

```bash
npm install
```

### Environment Variables

Create `.env.local`:

```env
# Database
POSTGRES_URL="postgresql://user:password@localhost:5432/dbname"

# NextAuth
AUTH_SECRET="your-auth-secret-here"  # Generate with: openssl rand -base64 32

# Dify API
DIFY_API_URL="https://api.dify.ai/v1"
DIFY_API_KEY="your-dify-api-key"
```

### Database Setup

The app uses PostgreSQL for user authentication. The database schema is managed by NextAuth:

```sql
-- Users table (managed by NextAuth)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000`

### Build

```bash
npm run build
npm start
```

## Project Structure

```
custom-web-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/    # NextAuth endpoints
│   │   │   ├── chat/messages/         # Chat API proxy
│   │   │   └── conversations/         # Conversation management
│   │   ├── login/                     # Login page
│   │   ├── register/                  # Registration page
│   │   ├── test/                      # Tailwind test page
│   │   ├── page.tsx                   # Main chat page
│   │   ├── layout.tsx                 # Root layout
│   │   └── globals.css                # Global styles + CSS variables
│   ├── components/
│   │   └── CustomStreamdown.tsx       # Enhanced Mermaid rendering
│   └── lib/
│       ├── auth.ts                    # NextAuth configuration
│       ├── api.ts                     # API utilities
│       └── db.ts                      # Database connection
├── tailwind.config.ts                 # Tailwind configuration
├── next.config.ts                     # Next.js configuration
└── package.json
```

## Configuration

### Dify.ai API
Update environment variables in `.env.local`:
```env
DIFY_API_URL="https://api.dify.ai/v1"
DIFY_API_KEY="your-api-key"
```

### LlamaIndex Knowledge Base
Add these variables to `.env.local` to enable the document count proxy:
```env
LLAMAINDEX_API_BASE_URL="https://api.cloud.llamaindex.ai/api/v1" # optional override
LLAMAINDEX_API_KEY="your-llamaindex-token"
LLAMAINDEX_PIPELINE_ID="e44456d9-6604-4d13-ba5d-8916d0aa398c" # used for /files2
```

### Tailwind CSS
The app uses a custom design system with CSS variables. See `src/app/globals.css` for color definitions:

- `--background`, `--foreground`: Base colors
- `--muted`, `--muted-foreground`: Muted UI elements
- `--border`, `--input`, `--ring`: UI accents
- Supports dark mode via `.dark` class

### Database
PostgreSQL connection via `POSTGRES_URL` environment variable.

## Key Components

### CustomStreamdown
Wraps Streamdown to enhance Mermaid diagrams without affecting other markdown features:

- Injects zoom button and download dropdown via DOM manipulation
- Captures original Mermaid code by intercepting Streamdown's copy button
- Renders high-quality images using Canvas API
- Uses MutationObserver to handle streaming content

### Chat Page (`src/app/page.tsx`)
Main chat interface with:
- Conversation sidebar with user info
- Message list with streaming support
- Ant Design X Sender component for input
- Loading states with workflow status ("正在思考", node titles)
- Error handling

### API Routes
- `/api/auth/[...nextauth]`: NextAuth handlers (login, logout, session)
- `/api/chat/messages`: Proxies Dify API with SSE streaming
- `/api/conversations`: Fetches conversation list from Dify

## Development Notes

### Authentication Flow
1. User registers → hashed password stored in PostgreSQL
2. User logs in → JWT token issued by NextAuth
3. Session validated via middleware on protected routes
4. Dify API calls use session user name for tracking

### Streaming Implementation
- Custom SSE parsing (no AI SDK dependency)
- Manual buffer management for `data: ` lines
- Real-time UI updates during streaming
- Workflow status tracking via event types

### Mermaid Enhancement Strategy
The app uses DOM post-processing rather than component override to maintain Streamdown's default behavior:

1. Streamdown renders all markdown (including Mermaid) normally
2. `useEffect` + `MutationObserver` detect rendered Mermaid blocks
3. Custom buttons are injected into the controls div
4. Original download button is hidden, copy button hijacked to capture source code

This approach ensures:
- Zero interference with non-Mermaid code blocks
- Full compatibility with Streamdown updates
- Clean separation of concerns

### Tailwind CSS Variables
All Streamdown utility classes (`bg-muted`, `border-border`, etc.) rely on CSS variables defined in `globals.css`. Without these definitions, the classes won't work.

## Testing

Visit `/test` to verify Tailwind utility classes are working correctly, including custom design tokens.

## License

ISC
