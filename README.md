# AI Agent Client

A powerful, dark-themed Next.js frontend built to interface with streaming AI agents. This client connects to a custom agent backend via WebSockets to provide real-time streaming responses, deep protocol tracing, and live context inspection.

## 🏛️ Architecture

The application follows an event-driven architecture centered around a sequence-aware WebSocket client. All incoming protocol events pass through a deduplication and reordering layer before being processed, ensuring correct behavior during out-of-order delivery, duplicate messages, connection drops, and replay recovery.

UI rendering is separated into three independent domains: Chat, Timeline, and Context Inspector. The client tracks the highest fully processed sequence number and uses the RESUME protocol to recover missed events after reconnection, allowing agent responses, tool calls, and context updates to continue seamlessly even in chaos mode.
<img width="1672" height="1680" alt="mermaid-diagram" src="https://github.com/user-attachments/assets/959289cc-5c69-49d7-aa35-3c1a85f1bb26" />

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

## 🚀 Running Against the Agent Server

To run this application locally, you need both the frontend client and the backend agent-server running simultaneously.

### 1. Start the Agent Server
First, ensure the backend agent-server is running. The client expects the server to be listening for WebSocket connections on port `4747`.
- Navigate to your agent-server directory.
- Start the server (e.g., `python main.py` or equivalent start command).
- Verify the server is listening at `ws://localhost:4747/ws`.

### 2. Start the Frontend Client
Once the backend is active, open a new terminal for the frontend:

```bash
# Install the necessary dependencies
npm install

# Start the Next.js development server
npm run dev
```

### 3. Connect
Open your browser and navigate to [http://localhost:3000](http://localhost:3000). The frontend will automatically attempt to connect to the agent-server. If the connection drops, it will infinitely attempt to reconnect every 2 seconds.

## 📡 WebSocket Protocol Specifications
This client expects specific JSON payloads from the backend, such as:
- `TOKEN`: Appends text to the active streaming message.
- `STREAM_END`: Seals the current AI response.
- `CONTEXT_SNAPSHOT`: Updates the state of the agent's memory/context.
- `TOOL_CALL` / `TOOL_RESULT`: Displays background actions the agent is taking.
