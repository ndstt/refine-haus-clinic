import { useMemo, useRef, useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

export default function ChatPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  
  // activeChat เก็บ session_id (String) หรือ null
  const [activeChat, setActiveChat] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);

  // เก็บรายชื่อแชททั้งหมด (Sidebar)
  // [ { id: "...", title: "..." }, ... ]
  const [chatList, setChatList] = useState([]);

  // เก็บข้อความของแชทปัจจุบัน
  const [messages, setMessages] = useState([]);
  
  const listRef = useRef(null);

  // 1. โหลดรายชื่อแชทเข้า Sidebar ตอนเปิดเว็บ
  useEffect(() => {
    fetchChats();
  }, []);

  async function fetchChats() {
    try {
      const res = await fetch(`${API_BASE}/chats`);
      const data = await res.json();
      setChatList(data);
    } catch (err) {
      console.error("Failed to load chats", err);
    }
  }

  // 2. เมื่อกดเลือกแชทเก่า (activeChat เปลี่ยน) ให้โหลดข้อความเก่า
  useEffect(() => {
    if (!activeChat) {
        setMessages([]); // ถ้าเป็น New Chat ให้เคลียร์หน้าจอ
        return;
    }

    async function fetchHistory() {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/chats/${activeChat}`);
            if(res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
            scrollToBottom();
        }
    }
    fetchHistory();
  }, [activeChat]);

  const filteredRecents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chatList;
    return chatList.filter((x) => x.title.toLowerCase().includes(q));
  }, [search, chatList]);

  const hasMessages = messages.length > 0;

  const scrollToBottom = () => {
    setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, 50);
  };

  // ปุ่ม New Chat กดแล้วจะรีเซ็ตทุกอย่าง
  const handleNewChat = () => {
    setActiveChat(null);
    setMessages([]);
    setPrompt("");
  };

  async function onSend() {
    const text = prompt.trim();
    if (!text || isLoading) return;

    // UI Optimistic Update (โชว์ข้อความเราก่อน)
    const userMsg = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    
    setPrompt("");
    setIsLoading(true);
    scrollToBottom();

    try {
        const payload = { 
            message: text, 
            session_id: activeChat // ถ้าเป็น null คือ New Chat
        };

        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("API Failed");

        const data = await response.json();
        const aiMsg = { role: "assistant", text: data.answer };

        // อัปเดตข้อความ AI
        setMessages((prev) => [...prev, aiMsg]);

        // ถ้าเป็นการเริ่มแชทครั้งแรก (New Chat)
        if (!activeChat) {
            setActiveChat(data.session_id); // set ID เพื่อให้คุยต่อได้
            // อัปเดต Sidebar ทันทีโดยไม่ต้องรีเฟรช
            setChatList(prev => [{ id: data.session_id, title: data.title }, ...prev]);
        }

    } catch (error) {
        console.error("Error:", error);
        setMessages(prev => [...prev, { role: "assistant", text: "Connection Error." }]);
    } finally {
        setIsLoading(false);
        scrollToBottom();
    }
  }

  return (
    <section className="bg-[#f6eadb]">
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
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="6.5" y="5.5" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {collapsed ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                {/* New Chat Button (Collapsed) */}
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5"
                  onClick={handleNewChat} // ✅ ใช้ handleNewChat
                  title="New chat"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/55">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
                {/* Search Icon */}
                <button className="grid h-11 w-11 place-items-center rounded-xl hover:bg-black/5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/55">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ) : (
              <div className="mt-6">
                {/* New Chat Button (Expanded) */}
                <button
                  type="button"
                  className="w-full rounded-xl hover:bg-black/5 flex items-center gap-3 px-2 py-2"
                  onClick={handleNewChat} // ✅ ใช้ handleNewChat
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full text-black/55">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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
                        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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

          {/* Recents Sidebar List */}
          {!collapsed && (
            <div className="mt-6 px-6 pb-8">
              <div className="text-[13px] text-black/35">Recents</div>
              <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
                {filteredRecents.length === 0 && (
                   <div className="text-[12px] text-black/30 italic">No history yet</div>
                )}
                {filteredRecents.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setActiveChat(chat.id)} // ✅ เปลี่ยน activeChat เป็น ID
                    className={[
                      "w-full rounded-lg px-2 py-1.5 text-left text-[14px] transition truncate",
                      activeChat === chat.id
                        ? "bg-black/5 text-black"
                        : "text-black/70 hover:bg-black/5",
                    ].join(" ")}
                  >
                    {chat.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1">
          <div className="relative flex min-h-[720px] flex-col">
            
            <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-10">
              {!hasMessages ? (
                // State: New Chat
                <div className="relative flex h-full min-h-[520px] items-center justify-center text-center">
                  <div className="relative w-full max-w-[760px]">
                    <div className="font-luxury text-[44px] leading-[1.05] tracking-[0.08em] text-black/80 sm:text-[56px]">
                      WHAT’S ON THE
                      <br />
                      AGENDA TODAY?
                    </div>
                    <div className="mt-5">
                      {/* Input Box ตรงกลาง */}
                      <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 shadow-sm">
                        <input
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          disabled={isLoading}
                          onKeyDown={(e) => {
                             if (e.key === "Enter") onSend();
                          }}
                          className="w-full bg-transparent text-[14px] text-black/70 placeholder:text-black/35 focus:outline-none"
                          placeholder={isLoading ? "Starting chat..." : "Ask here..."}
                        />
                         <button
                          type="button"
                          onClick={onSend}
                          disabled={isLoading}
                          className="grid h-9 w-9 place-items-center rounded-full text-black/60 hover:bg-black/5"
                        >
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // State: Chat History
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
                   {isLoading && (
                    <div className="mr-auto w-fit max-w-[85%] text-[13px] leading-relaxed text-black/40 animate-pulse">
                      Processing...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Composer (Bottom) */}
            {hasMessages && (
              <div className="border-t border-black/10 bg-[#f6eadb] px-6 py-6">
                <div className="mx-auto w-full max-w-[760px]">
                  <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 shadow-sm">
                    <input
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSend();
                      }}
                      className="w-full bg-transparent text-[14px] text-black/70 placeholder:text-black/35 focus:outline-none"
                      placeholder="Ask here..."
                    />
                    <button
                      type="button"
                      onClick={onSend}
                      disabled={isLoading}
                      className="grid h-9 w-9 place-items-center rounded-full text-black/60 hover:bg-black/5"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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