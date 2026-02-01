import { useEffect, useMemo, useRef, useState } from "react";

// Lumina (Chatbot) page
// Goal: match Inventory page layout
// - Same container: bg + padding + max width
// - Left sidebar: collapsible, same sizing/spacing style as inventory sidebar
// - Right content: centered hero + ask box (empty state), chat list for later

function ToggleIcon() {
  // Same collapse/expand icon style used in inventory page
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="6.5"
        y="5.5"
        width="11"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 8h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LuminaPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const listRef = useRef(null);

  const apiBase = useMemo(
    () => import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1",
    []
  );

  const activeConversations = useMemo(() => conversations, [conversations]);

  async function loadConversations(nextSearch = "") {
    try {
      const query = nextSearch ? `?search=${encodeURIComponent(nextSearch)}` : "";
      const res = await fetch(`${apiBase}/chat/conversations${query}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      setConversations([]);
    }
  }

  async function loadMessages(conversationId) {
    try {
      const res = await fetch(
        `${apiBase}/chat/conversations/${conversationId}/messages`
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map((msg) => ({
            role: msg.role === "USER" ? "user" : "assistant",
            text: msg.content,
          }))
        : [];
      setMessages(normalized);
    } catch (err) {
      setMessages([]);
    }
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      loadConversations(search.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  async function onSend() {
    const text = prompt.trim();
    if (!text || isSending) return;
    setSendError("");

    const userMessage = { role: "user", text };
    const assistantPlaceholder = { role: "assistant", text: "...", pending: true };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setPrompt("");
    setIsSending(true);

    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 0);

    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: activeConversationId,
        }),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = await res.json();
      const replyText = data?.response ?? "No response.";
      const conversationId = data?.conversation_id ?? activeConversationId;

      setMessages((prev) =>
        prev.slice(0, -1).concat({ role: "assistant", text: replyText })
      );
      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversationId(conversationId);
      }
      await loadConversations(search.trim());
    } catch (err) {
      setMessages((prev) =>
        prev.slice(0, -1).concat({
          role: "assistant",
          text: "Sorry, something went wrong. Please try again.",
        })
      );
      setSendError("Cannot reach backend. Check API or server status.");
    } finally {
      setIsSending(false);
    }
  }

  const isEmpty = messages.length === 0;

  // Keep the list pinned to bottom on new messages (scroll inside the chat box)
  useEffect(() => {
    if (isEmpty) return;
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, [messages.length, activeConversationId, isEmpty]);


  return (
    <section className="bg-[#f6eadb] px-6 py-10">
      {/* same layout frame as inventory */}
      <div className="mx-auto flex w-full max-w-[1200px]">
        {/* Sidebar (collapse/expand) */}
        <aside
          className={[
            "border-r border-black/10 bg-[#f6eadb] transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-[240px]",
          ].join(" ")}
        >
          {/* top header row */}
          <div
            className={[
              "pt-6 flex items-center",
              collapsed ? "px-2 justify-center" : "px-6 justify-between",
            ].join(" ")}
          >
            {!collapsed && (
              <div className="font-luxury text-[22px] uppercase tracking-[0.18em] text-black">
                LUMINA
              </div>
            )}

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full text-black/50 hover:bg-black/5"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              <ToggleIcon />
            </button>
          </div>

          {/* nav / actions */}
          {collapsed ? (
            // collapsed: icon only, aligned like inventory collapsed
            <div className="mt-8 flex flex-col items-center gap-3 pb-10">
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-2xl hover:bg-black/5"
                aria-label="New chat"
                title="New chat"
                onClick={() => {
                  setActiveConversationId(null);
                  setMessages([]);
                  setPrompt("");
                }}
              >
                <span className="text-black/55">
                  <PlusIcon />
                </span>
              </button>

              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-2xl hover:bg-black/5"
                aria-label="Search"
                title="Search"
              >
                <span className="text-black/55">
                  <SearchIcon />
                </span>
              </button>
            </div>
          ) : (
            // expanded
            <div className="mt-6 px-4 pb-10">
              <div className="space-y-1">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-black/5"
                  onClick={() => {
                    setActiveConversationId(null);
                    setMessages([]);
                    setPrompt("");
                  }}
                >
                  <span className="text-black/55">
                    <PlusIcon />
                  </span>
                  <span className="text-[16px] text-black/80">New chat</span>
                </button>

                <div className="w-full flex items-start gap-3 rounded-xl px-4 py-3 hover:bg-black/5">
                  <span className="mt-1 text-black/55">
                    <SearchIcon />
                  </span>
                  <div className="flex-1">
                    <div className="text-[16px] text-black/80">Search</div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="mt-1 w-full bg-transparent text-[12px] text-black/50 placeholder:text-black/30 focus:outline-none"
                      placeholder="Search chat..."
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <div className="px-2 text-[12px] text-black/35">Recents</div>
                  <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto px-2 pr-1">
                    {activeConversations.map((chat) => (
                      <button
                        key={chat.conversation_id}
                        type="button"
                        onClick={() => {
                          setActiveConversationId(chat.conversation_id);
                          loadMessages(chat.conversation_id);
                        }}
                        className={[
                          "w-full text-left text-[13px] hover:text-black",
                          activeConversationId === chat.conversation_id
                            ? "text-black"
                            : "text-black/65",
                        ].join(" ")}
                        title={chat.title || "New chat"}
                      >
                        {chat.title || "New chat"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main content - same padding as inventory */}
        <div className="flex-1 px-8 py-6">
          {/* content frame */}
          <div className="relative">
            {/* If empty -> centered hero (like the screenshot) */}
            {isEmpty ? (
              <div className="relative flex h-[720px] items-center justify-center">
                {/* soft gradient ellipse (center) */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[560px] -translate-x-1/2 -translate-y-1/2" />

                <div className="relative mx-auto w-full max-w-[760px] text-center">
                  <div className="font-luxury text-[44px] leading-[1.05] tracking-[0.08em] text-black/80 sm:text-[56px]">
                    WHAT'S ON THE
                    <br />
                    AGENDA TODAY?
                  </div>

                  {/* bring ask box closer to the title */}
                  <div className="mt-4">
                    <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 shadow-sm">
                      <input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSend();
                        }}
                        className="w-full bg-transparent text-[14px] text-black/70 placeholder:text-black/35 focus:outline-none"
                        placeholder="Ask here..."
                      />

                      <button
                        type="button"
                        onClick={onSend}
                        className="grid h-9 w-9 place-items-center rounded-full text-black/60 hover:bg-black/5 disabled:opacity-60"
                        aria-label="Send"
                        title="Send"
                        disabled={isSending}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 12h12"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M13 6l6 6-6 6"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // non-empty -> simple chat list + composer (UI only)
              <div className="flex h-[720px] flex-col overflow-hidden">
                <div
                  ref={listRef}
                  style={{ scrollbarGutter: "stable" }}
                  className="flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-black/10 bg-white/60 p-4 pr-2"
                >
                  <div className="space-y-3">
                    {messages.map((m, idx) => (
                      <div
                        key={idx}
                        className={
                          m.role === "user"
                            ? "ml-auto max-w-[80%] rounded-2xl bg-white px-4 py-2 text-[13px] text-black/75 shadow-sm"
                            : "mr-auto max-w-[80%] rounded-2xl bg-black/5 px-4 py-2 text-[13px] text-black/70"
                        }
                      >
                        {m.text}
                      </div>
                    ))}
                    {sendError ? (
                      <div className="text-[12px] text-red-600">{sendError}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 shadow-sm">
                    <input
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSend();
                      }}
                      className="w-full bg-transparent text-[14px] text-black/70 placeholder:text-black/35 focus:outline-none"
                      placeholder="Ask here..."
                    />

                    <button
                      type="button"
                      onClick={onSend}
                      className="grid h-9 w-9 place-items-center rounded-full text-black/60 hover:bg-black/5 disabled:opacity-60"
                      aria-label="Send"
                      title="Send"
                      disabled={isSending}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 12h12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M13 6l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
