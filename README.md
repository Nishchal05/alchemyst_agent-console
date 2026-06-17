# AI Agent Client

A powerful, dark-themed Next.js frontend built to interface with streaming AI agents. This client connects to a custom agent backend via WebSockets to provide real-time streaming responses, deep protocol tracing, and live context inspection.

## ✨ Features

- **Real-Time Streaming:** Watch the AI's responses stream in token-by-token with zero perceived latency.
- **Trace Timeline:** A built-in debugging pane that logs raw WebSocket protocol events (Tokens, Tool Calls, Tool Results, and Context Snapshots) in real-time.
- **Live Context Inspector:** Peek under the hood and view the agent's active memory and context payload exactly as the backend sees it.
- **Robust Auto-Reconnect:** Seamless connection handling that automatically attempts to reconnect if the backend drops, and intelligently resumes interrupted streams using sequence IDs.
- **Custom Virtual Scrolling:** Optimized scrolling implementation to keep the UI snappy even when the protocol timeline fills up with hundreds of events.
- **Modern UI:** Built with Tailwind CSS and Shadcn UI, featuring a sleek, developer-focused dark mode aesthetic.

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (React 19)
- **Styling:** Tailwind CSS + Shadcn UI
- **Network:** Native WebSockets
- **Language:** TypeScript

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Connect the Backend:**
   Ensure your WebSocket backend is running on `ws://localhost:4747/ws`. The client will automatically connect and listen for events.

## 📡 WebSocket Protocol Specifications
This client expects specific JSON payloads from the backend, such as:
- `TOKEN`: Appends text to the active streaming message.
- `STREAM_END`: Seals the current AI response.
- `CONTEXT_SNAPSHOT`: Updates the state of the agent's memory/context.
- `TOOL_CALL` / `TOOL_RESULT`: Displays background actions the agent is taking.
