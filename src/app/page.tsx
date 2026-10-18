"use client";
import { useState, useRef, useEffect } from "react";

type Verse = { ref: string; surah: string; arabic: string; english: string };
type Msg = { role: "user" | "assistant"; content: string; verses?: Verse[] };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        { role: "assistant", content: data.reply ?? `Error: ${data.error}`, verses: data.verses },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error" }]);
    }
    setLoading(false);
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100dvh", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: "#666" }}>Ask a topic or enter a reference like 2:255.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{
              background: m.role === "user" ? "#2563eb" : "#e5e7eb",
              color: m.role === "user" ? "#fff" : "#111",
              padding: "10px 14px", borderRadius: 16, maxWidth: "88%", whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
            {m.verses?.map((v) => (
              <div key={v.ref} style={{ marginTop: 8, padding: 12, border: "1px solid #ddd", borderRadius: 12, width: "100%", background: "#fafafa", color: "#111" }}>
                <div style={{ fontSize: 12, color: "#666" }}>{v.surah} · {v.ref}</div>
                <div dir="rtl" lang="ar" style={{ fontSize: 24, lineHeight: 2, margin: "6px 0" }}>{v.arabic}</div>
                <div style={{ fontSize: 14 }}>{v.english}</div>
              </div>
            ))}
          </div>
        ))}
        {loading && <div style={{ color: "#888" }}>Searching…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #ddd" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask or enter 2:255…"
          style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #ccc", fontSize: 16 }}
        />
        <button onClick={send} disabled={loading} style={{ padding: "0 18px", borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontSize: 16 }}>
          Send
        </button>
      </div>
    </main>
  );
}
