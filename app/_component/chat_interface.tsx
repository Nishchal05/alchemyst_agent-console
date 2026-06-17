"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

type ChatMessage = {
    type: string;
    content: string;
    streaming?: boolean;
    seq?: number;
};

type TokenData = {
    seq: number;
    text: string;
    type?: string;
};

export default function ChatInterface() {
    const wsRef = useRef<WebSocket | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const bufferMap = useRef(new Map<number, TokenData>());
    const completedStreams = useRef(new Set<string>());
    const interupted = useRef(false);
    const expectedSeq = useRef<number | null>(null);
    const seenSeqs = useRef(new Set<number>());
    const trackStreem = useRef<string | null>(null);
    const lastProcessedSeq =useRef<number>(0);
    const [timelineStart, setTimelineStart] = useState(0);
    const [chatStart, setChatStart] = useState(0);
    const [contextStart, setContextStart] = useState(0);
    const [context, setContext] = useState<any[]>([]);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState("");
    const [connectionStatus, setConnectionStatus] = useState("Connecting...");
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    function flush() {
        setChatMessages([...messagesRef.current]);
    }

    function appendToken(text: string, seq?: number) {
        const msgs = messagesRef.current;
        const last = msgs[msgs.length - 1];
        if (last && last.type === "ASSISTANT_MESSAGE" && last.streaming !== false) {
            msgs[msgs.length - 1] = { ...last, content: last.content + text, seq: seq };
        } else {
            msgs.push({ type: "ASSISTANT_MESSAGE", content: text, streaming: true, seq: seq });
        }
    }

    function drainBuffer() {
        while (
            expectedSeq.current !== null &&
            bufferMap.current.has(expectedSeq.current)
        ) {
            const evt = bufferMap.current.get(expectedSeq.current)!;
            lastProcessedSeq.current = evt.seq;
            appendToken(evt.text, evt.seq);
            bufferMap.current.delete(expectedSeq.current);
            expectedSeq.current++;
        }
        flush();
    }

    function addUserMessage(content: string) {
        messagesRef.current.push({ type: "USER_MESSAGE", content });
        flush();
    }
    const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setTimelineStart(Math.floor(e.currentTarget.scrollTop / 100));
    };
    const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setChatStart(Math.floor(e.currentTarget.scrollTop / 100));
    };
    const handleContextScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setContextStart(Math.floor(e.currentTarget.scrollTop / 100));
    }; 
    
    useEffect(() => {
        let ws: WebSocket;
        let reconnectTimeout: NodeJS.Timeout;
        let isUnmounted = false;

        const connect = () => {
            if (isUnmounted) return;
            
            ws = new WebSocket("ws://localhost:4747/ws");
            wsRef.current = ws;

            ws.onopen = () => { 
                console.log("Connected"); 
                setConnectionStatus("Connected"); 
               
                if (interupted.current) {
                    ws.send(
                        JSON.stringify({
                            type: "RESUME",
                            last_seq: lastProcessedSeq.current,
                        })
                    );
                    interupted.current = false;
                }
            };

            ws.onclose = () => { 
                console.log("Disconnected"); 
                setConnectionStatus("Disconnected"); 
            
                if (trackStreem.current && !completedStreams.current.has(trackStreem.current)) {
                    interupted.current = true;
                    
                }
                
                if (!isUnmounted) {
                    reconnectTimeout = setTimeout(connect, 2000);
                }
            };

            ws.onerror = () => console.warn("WebSocket encountered an error (likely disconnected). Retrying...");

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setTimeline((prev) => [...prev, data]);
                trackStreem.current = data.stream_id;
                switch (data.type) {
                    case "TOKEN": {
                        if (seenSeqs.current.has(data.seq)) return;
                        seenSeqs.current.add(data.seq);

                        if (expectedSeq.current === null) {
                            expectedSeq.current = data.seq;
                        }

                        bufferMap.current.set(data.seq, data);
                        drainBuffer();
                        break;
                    }
                    case "CONTEXT_SNAPSHOT": {
                        setContext((prev) => [...prev, data]);
                        bufferMap.current.clear();
                        seenSeqs.current.clear();
                        expectedSeq.current = data.seq + 1;
                        break;
                    }

                    case "TOOL_CALL": {
                        ws.send(JSON.stringify({ type: "TOOL_ACK", call_id: data.call_id }));
                        expectedSeq.current = data.seq + 1;
                        break;
                    }

                    case "TOOL_RESULT": {
                        expectedSeq.current = data.seq + 1;
                        break;
                    }
                    case "STREAM_END":
                        {
                            completedStreams.current.add(data.stream_id);
                            break;
                        }
                    case "PING":
                        {
                            ws.send(JSON.stringify({ type: "PONG", "echo": data.challenge }));
                        }
                    case "PONG":
                        break;

                    default:
                        break;
                }
            };
        };

        connect();

        return () => {
            isUnmounted = true;
            clearTimeout(reconnectTimeout);
            ws?.close();
        };
    }, []);

    const submitUserInput = () => {
        if (!userInput.trim()) return;
        addUserMessage(userInput);
        wsRef.current?.send(JSON.stringify({ type: "USER_MESSAGE", content: userInput }));
        setUserInput("");
    };

    return (
        <section className="h-[90vh] bg-zinc-950 text-zinc-100 p-4">
            <div className="grid h-[85vh] grid-cols-12 gap-4">

                {/* Context Inspector */}
                <aside className="col-span-3 hidden lg:flex flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="border-b border-zinc-800 px-4 py-3">
                        <h2 className="font-semibold">Context Inspector</h2>
                        <p className="text-xs text-zinc-400">Active agent context</p>
                    </div>
                    <div className="flex-1 min-h-0">
                        <div className="h-[70vh] w-full rounded-md border overflow-y-auto relative no-scrollbar" onScroll={handleContextScroll}>
                            <div style={{ height: context.length * 100 }} />
                            <div className="absolute top-0 left-0 right-0 p-4 space-y-4" style={{ transform: `translateY(${contextStart * 100}px)` }}>
                                {context.slice(contextStart, contextStart + 10).map((item, index) => (
                                    <pre key={contextStart + index} className="text-xs text-zinc-300 border-b border-zinc-800 pb-2">
                                        {JSON.stringify(item, null, 2)}
                                    </pre>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Chat Panel */}
                <main className="col-span-12 lg:col-span-6 flex flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                        <div>
                            <h1 className="font-semibold text-lg">AI Agent Console</h1>
                            <p className="text-xs text-zinc-400">Streaming agent responses</p>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs font-medium ${connectionStatus === "Connected"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                            }`}>
                            {connectionStatus}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0" >
                        <div className="h-[70vh] overflow-y-auto relative no-scrollbar" onScroll={handleChatScroll}>
                            <div style={{ height: chatMessages.length * 100 }} />
                            <div className="absolute top-0 left-0 right-0 p-5 space-y-4" style={{ transform: `translateY(${chatStart * 100}px)` }}>
                                {chatMessages.slice(chatStart, chatStart + 50).map((msg, index) => (
                                    <div
                                        key={chatStart + index}
                                        className={`max-w-[85%] mb-2 rounded-xl px-4 py-3 ${msg.type === "USER_MESSAGE"
                                            ? "ml-auto bg-blue-600 text-white"
                                            : "bg-zinc-800 text-zinc-100"
                                            }`}
                                    >
                                        <div className="mb-1 text-xs opacity-70 flex items-center gap-2">
                                            {msg.type === "USER_MESSAGE" ? "You" : "Assistant"}
                                            {msg.streaming && (
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                            )}
                                        </div>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-zinc-800 p-4">
                        <div className="flex gap-3">
                            <input
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && submitUserInput()}
                                placeholder="Ask the agent..."
                                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={submitUserInput}
                                className="rounded-lg bg-blue-600 px-5 py-3 cursor-pointer text-sm font-medium hover:bg-blue-500 transition"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </main>


                <aside className="col-span-3 hidden lg:flex flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="border-b border-zinc-800 px-4 py-3">
                        <h2 className="font-semibold">Trace Timeline</h2>
                        <p className="text-xs text-zinc-400">
                            Protocol events
                        </p>
                    </div>
                    <div>
                        <div 
                            className="flex-1 h-[70vh] p-3 overflow-y-auto relative no-scrollbar" 
                            onScroll={handleTimelineScroll}
                        >
                            <div style={{ height: timeline.length * 100 }} />
                            
                            <div 
                                className="absolute top-0 left-0 right-0 space-y-2 p-3"
                                style={{ transform: `translateY(${timelineStart * 100}px)` }}
                            >
                                {timeline.slice(timelineStart, timelineStart + 13).map((event, index) => {
                                    const actualIndex = timelineStart + index;
                                    return (
                                        <div
                                            key={actualIndex}
                                            className={`rounded-lg border border-zinc-800 bg-zinc-950 p-3 h-[90px] relative ${openIndex === actualIndex ? 'z-50' : 'z-10'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm">
                                                    {event.type}
                                                </span>

                                                <div className="flex items-center gap-2">
                                                    {event.seq !== undefined && (
                                                        <span className="text-xs text-zinc-500">
                                                            #{event.seq}
                                                        </span>
                                                    )}

                                                    <button
                                                        className="text-xs px-2 py-1 rounded bg-zinc-800 cursor-pointer"
                                                        onClick={() =>
                                                            setOpenIndex(
                                                                openIndex === actualIndex
                                                                    ? null
                                                                    : actualIndex
                                                            )
                                                        }
                                                    >
                                                        {openIndex === actualIndex
                                                            ? "Close"
                                                            : "Open"}
                                                    </button>
                                                </div>
                                            </div>

                                            {openIndex === actualIndex && (
                                                <div className="absolute top-[90px] left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-2xl">
                                                    <pre className="text-xs overflow-auto text-zinc-300 max-h-60">
                                                        {JSON.stringify(
                                                            event,
                                                            null,
                                                            2
                                                        )}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </section>
    );
}