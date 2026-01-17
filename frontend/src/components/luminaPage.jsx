import { useMemo, useState } from "react";

const PRESET_MESSAGES = [
  {
    from: "assistant",
    text:
      "Based on historical data and recent booking trends, the projected revenue for next month is $15,000 - $18,000, assuming a stable booking rate.\n\nKey factors affecting revenue:\n- If promotional campaigns (like the suggested 'Spring Glow-Up Package') perform well, we could see a 10-15% increase in total bookings.\n- External factors such as holidays and special events may drive a temporary surge in appointments.\n- Retention rate improvements from loyalty programs could add an additional $1,000 in recurring revenue.\n\nRecommendation:\nMonitor high-spending clients from the past 3 months and send personalized treatment offers via email or SMS to drive repeat visits.",
  },
  {
    from: "assistant",
    text:
      "Today's revenue stands at $3,200, generated from a total of 45 completed transactions. The top three services contributing to the revenue today are:\n\nBotox Treatment – 15 bookings ($1,500)\nPRP Therapy – 10 bookings ($800)\nLaser Resurfacing – 8 bookings ($600)\n\nThe remaining transactions came from skincare product sales and consultation fees. Based on your revenue trends, today's earnings are 5% higher compared to the previous Monday. Keep an eye on peak booking hours between 2:00 PM - 5:00 PM.",
  },
];

export default function LuminaPage() {
  const [input, setInput] = useState("");

  const messages = useMemo(() => PRESET_MESSAGES, []);

  return (
    <section className="bg-[#f6eadb] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-sm">
          <div className="font-luxury text-[26px] uppercase tracking-[0.12em] text-black">
            History chat Lumina Chatbots
          </div>
          <div className="mt-1 text-[13px] text-black/60">
            Predict revenue · Revenue report
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="max-h-[560px] space-y-4 overflow-y-auto px-6 py-6">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={[
                  "rounded-2xl px-5 py-4 text-[13px] leading-relaxed",
                  m.from === "assistant"
                    ? "bg-[#f8efe7] text-black/80"
                    : "bg-[#a39373] text-black",
                ].join(" ")}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="border-t border-black/10 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f8efe7] px-4 text-[12px] text-black placeholder:text-black/40 focus:outline-none"
                placeholder="Ask here..."
              />
              <button
                type="button"
                className="h-11 w-full rounded-xl bg-[#a39373] px-6 text-[12px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-[#b4a279] sm:w-44"
              >
                Send
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {["Show me today's revenue report.", "Predict next month's expected revenue."].map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInput(p)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-black/70 hover:bg-[#f8efe7]"
                  >
                    {p}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
