# Architectural Decisions & Future Scaling

This document outlines the core architectural decisions made in the agent-client frontend, specifically addressing event ordering, rendering strategies, state recovery, and potential scaling constraints.

## 1. Sequence-Based Ordering & Deduplication
**Approach:** We use a combination of a `Map<number, TokenData>` for buffering and a `Set<number>` for deduplication. 
**Why:** Because WebSocket packets can arrive out-of-order or be duplicated during network jitter, the `seenSeqs` Set guarantees that a payload sequence is processed exactly once. If a token arrives prematurely (e.g., we expect seq `5` but receive seq `7`), it is temporarily stored in the `bufferMap`. The `drainBuffer` function recursively checks the Map to see if the sequentially next required token has arrived, extracting and rendering them strictly in order. A `Map` provides `O(1)` lookups for sequence matching without needing to constantly sort an array.

## 2. Preventing Layout Shift During Tool Call Interruptions
**Approach:** The UI prevents layout shifting (Cumulative Layout Shift) by strictly separating the rendering domains.
**Strategy:** Tool calls and agent internal thoughts are routed to the separate "Trace Timeline" panel rather than being injected directly into the conversational chat flow. Within the Timeline, when a user expands a complex tool result payload, we use an absolute-positioned overlay (`absolute z-50` dropdown approach) rather than expanding the DOM element's physical height. This ensures the manual virtual scrolling mathematical constraints remain completely stable, and no parent containers shift to accommodate the expanding JSON tree.

## 3. Reconnection State Recovery (DOM vs. Socket)
**Approach:** The client explicitly tracks two different boundaries: what the network has *received*, and what the UI has *consumed*.
**Strategy:** 
- Network Boundary: `seenSeqs.current` tracks every raw payload touched by the socket to filter immediate duplicates.
- DOM/Consumption Boundary: `lastProcessedSeq.current` tracks the highest sequence number that successfully survived the ordering buffer and was physically flushed to the `messagesRef` UI state. 
When a connection drops and `connect()` triggers a WebSocket reconnect, the `onopen` handler sends a `RESUME` payload containing `lastProcessedSeq`. This commands the backend to replay only the events that the DOM actually missed, entirely ignoring what the previous socket instance might have received but left stranded in the memory buffer.

## 4. Scaling to 50 Concurrent Agent Streams (Operations Dashboard)
If this client needed to render 50 active agent streams simultaneously on a single screen, the current architecture would bottleneck the browser's main thread. 
**What would change:**
- **State Management:** Local `useState` and massive `useRef` maps would be migrated to a global state manager like Zustand, or preferably, a Web Worker. Parsing JSON and ordering sequences for 50 rapid streams would freeze the UI if processed on the main thread.
- **Network Multiplexing:** 50 raw WebSockets would exhaust browser connection limits. We would switch to a multiplexed WebSocket connection (one socket handling 50 channel streams) or Server-Sent Events (SSE) using HTTP/2 multiplexing.
- **UI Virtualization:** The container holding the 50 streams would need strict DOM virtualization. Only the streams actively visible in the viewport would receive React re-renders; the rest would update a background data store but skip DOM reconciliation entirely.

## 5. Scaling to 100x Longer Responses (Full Document Generation)
If the agent began streaming 500,000-character documents instead of short chat messages, the current text rendering and virtual scrolling would fail.
**What would change:**
- **Variable-Height Virtualization:** Our current custom virtual scroller assumes a fixed ~100px height per item. We would integrate a robust virtualization library like `@tanstack/react-virtual` capable of dynamic `ResizeObserver`-based height measurements.
- **Chunked DOM Rendering:** React struggles to constantly re-render a single `div` containing 500,000 characters every few milliseconds as new tokens arrive. The single massive text block would be paginated or broken down into paragraph-level chunks. As the document streams, only the final "active" paragraph chunk would trigger a re-render, leaving the previous 99% of the document completely static in the DOM.
