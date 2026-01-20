import { useMemo, useRef, useState } from "react";

// Chat layout (UI only)
// - Left sidebar: collapse/expand, new chat, search, recent chats
// - Right: chat area (scrollable) + composer
// - Empty state: centered hero prompt + ask box

const RECENTS = [
  "Revenue Report",
  "Suggest promotion for ...",
  "Restock Medicine",
  "Example Chat 4",
  "Example Chat 5",
  "Example Chat 6",
  "Example Chat 7",
  "Example Chat 8",
];

const SAMPLE_CONVERSATION = [
  {
    role: "user",
    text: "Show me revenue of this month",
  },
  {
    role: "assistant",
    text:
      "Based on historical data and recent booking trends, the projected revenue for next month is $15,000 - $18,000, assuming a stable booking rate. Key factors affecting revenue:\n" +
      "- If promotional campaigns (like the suggested 'Spring Glow-Up Package') perform well, we could see a 10-15% increase in total bookings.\n" +
      "- External factors such as holidays and special events may drive a temporary surge in appointments.\n" +
      "- Retention rate improvements from loyalty programs could add an additional $1,000 in recurring revenue.\n\n" +
      "Recommendation: Monitor high-spending clients from the past 3 months and send personalized treatment offers via email or SMS to drive repeat visits.",
  },
  {
    role: "user",
    text: "What is top three service?",
  },
  {
    role: "assistant",
    text:
      "Today's revenue stands at $3,200, generated from a total of 45 completed transactions. The top three services contributing to the revenue today are:\n\n" +
      "Botox Treatment - 15 bookings ($1,500)\n" +
      "PRP Therapy - 10 bookings ($800)\n" +
      "Laser Resurfacing - 8 bookings ($600)\n\n" +
      "The remaining transactions came from skincare product sales and consultation fees. Based on your revenue trends, today's earnings are 5% higher compared to the previous Monday. Keep an eye on peak booking hours between 2:00 PM - 5:00 PM.",
  },
];

function cloneConversation() {
  return SAMPLE_CONVERSATION.map((msg) => ({ ...msg }));
}

export default function ChatPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [activeChat, setActiveChat] = useState(RECENTS[0]);
  const [messagesByChat, setMessagesByChat] = useState(() =>
    RECENTS.reduce((acc, name) => {
      acc[name] = cloneConversation();
      return acc;
    }, {})
  );
  const [draftMessages, setDraftMessages] = useState([]);
  const listRef = useRef(null);

  const filteredRecents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RECENTS;
    return RECENTS.filter((x) => x.toLowerCase().includes(q));
  }, [search]);

  const messages = activeChat
    ? messagesByChat[activeChat] || []
    : draftMessages;
  const hasMessages = messages.length > 0;

  function onSend() {
    const text = prompt.trim();
    if (!text) return;
    if (activeChat) {
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChat]: [...(prev[activeChat] || []), { role: "user", text }],
      }));
    } else {
      setDraftMessages((prev) => [...prev, { role: "user", text }]);
    }
    setPrompt("");
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 0);
  }

  return (
    <section className="bg-[#f6eadb]">
      {/* IMPORTANT: remove outer padding so it looks like a full product page */}
      <div className="mx-auto flex w-full max-w-495">
        {/* Sidebar */}
        <aside
          className={[
            "border-r border-black/10 bg-[#f6eadb]",
            "transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-[280px]",
          ].join(" ")}
        >
          <div className={collapsed ? "px-2 pt-6" : "px-6 pt-6"}>
            {/* Center the toggle icon when collapsed (fix alignment) */}
            <div
              className={
                collapsed
                  ? "flex items-center justify-center"
                  : "flex items-center justify-between"
              }
            >
              {!collapsed && (
                <div className="font-luxury text-[22px] tracking-[0.12em] text-black">
                  LUMINA
                </div>
              )}

              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="grid h-9 w-9 place-items-center rounded-full text-black/50 hover:bg-black/5"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {/* collapse/expand icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="6.5"
                    y="5.5"
                    width="11"
                    height="13"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10 8h4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Actions */}
            {collapsed ? (
              // Collapsed: stack icons and center them
              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5"
                  aria-label="New chat"
                  title="New chat"
                  onClick={() => {
                    setActiveChat(null);
                    setPrompt("");
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/55">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5"
                  aria-label="Search"
                  title="Search"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/55">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M20 20l-3.5-3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              // Expanded: icon + label aligned
              <div className="mt-6">
                {/* New chat */}
                <button
                  type="button"
                  className="w-full rounded-xl hover:bg-black/5 flex items-center gap-3 px-2 py-2"
                  onClick={() => {
                    setActiveChat(null);
                    setPrompt("");
                  }}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full text-black/55">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="text-[15px] text-black/80">New chat</span>
                </button>

                {/* Search */}
                <div className="mt-2 rounded-xl hover:bg-black/5 px-2 py-2">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full text-black/55">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/55">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                        <path
                          d="M20 20l-3.5-3.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>

                    <div className="flex-1">
                      <div className="text-[15px] text-black/80">Search</div>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="mt-1 w-full bg-transparent text-[12px] text-black/50 placeholder:text-black/30 focus:outline-none"
                        placeholder="Search chat..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recents */}
          {!collapsed && (
            <div className="mt-6 px-6 pb-8">
              <div className="text-[13px] text-black/35">Recents</div>
              <div className="mt-3 space-y-2">
                {filteredRecents.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setActiveChat(name)}
                    className={[
                      "w-full rounded-lg px-2 py-1.5 text-left text-[14px] transition",
                      activeChat === name
                        ? "bg-black/5 text-black"
                        : "text-black/70 hover:bg-black/5",
                    ].join(" ")}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <div className="flex-1">
          <div className="relative flex min-h-[720px] flex-col">
            {/* Chat / empty state */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-10">
              {!hasMessages ? (
                <div className="relative flex h-full min-h-[520px] items-center justify-center text-center">
                  <div className="relative w-full max-w-[760px]">
                    <div className="font-luxury text-[44px] leading-[1.05] tracking-[0.08em] text-black/80 sm:text-[56px]">
                      WHAT’S ON THE
                      <br />
                      AGENDA TODAY?
                    </div>

                    {/* Ask box close to the title */}
                    <div className="mt-5">
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
                          className="grid h-9 w-9 place-items-center rounded-full text-black/60 hover:bg-black/5"
                          aria-label="Send"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
                <div className="mx-auto w-full max-w-[760px] space-y-6">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={
                        m.role === "user"
                          ? "ml-auto w-fit max-w-[80%] rounded-full bg-[#e9dccf] px-4 py-2 text-[13px] text-black/75 shadow-sm"
                          : "mr-auto w-fit max-w-[85%] text-[13px] leading-relaxed text-black/70"
                      }
                    >
                      <span className="whitespace-pre-line">{m.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Composer (bottom) - show only when there are messages */}
            {hasMessages && (
              <div className="border-t border-black/10 bg-[#f6eadb] px-6 py-6">
                <div className="mx-auto w-full max-w-[760px]">
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
                      className="grid h-9 w-9 place-items-center rounded-full text-black/60 hover:bg-black/5"
                      aria-label="Send"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
