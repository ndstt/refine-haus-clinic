import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DAYS = [
  { label: "MEI", day: 24, dow: "JUM" },
  { label: "MEI", day: 25, dow: "SAB" },
  { label: "MEI", day: 26, dow: "MIN" },
  { label: "MEI", day: 27, dow: "SEN" },
  { label: "MEI", day: 28, dow: "SEL" },
  { label: "MEI", day: 29, dow: "RAB" },
  { label: "MEI", day: 30, dow: "KAM" },
  { label: "MEI", day: 31, dow: "JUM" },
  { label: "JUN", day: 1, dow: "SAB" },
  { label: "JUN", day: 2, dow: "MIN" },
];

export default function BookingTimePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const service = location.state?.service;

  const [selectedDay, setSelectedDay] = useState(DAYS[1]);
  const [period, setPeriod] = useState("Afternoon");
  const [time, setTime] = useState("10:00");

  const title = service?.title ?? "Anti Facial Acne";
  const price = service?.price ?? 4160;
  const therapist = service?.therapist ?? "Dr Napat";

  const dateLabel = useMemo(() => {
    return `${selectedDay.day} ${selectedDay.label} 2025`;
  }, [selectedDay]);

  return (
    <section className="bg-[#E6D4B9] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Booking Time
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-2xl bg-[#f8efe7] px-8 pb-10 pt-12 sm:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
            {/* calendar */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-[14px] font-semibold text-black">Select date</div>
                <div className="inline-flex overflow-hidden rounded-full border border-black/10">
                  {["Morning", "Afternoon"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={[
                        "px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.18em]",
                        period === p ? "bg-[#a39373] text-black" : "bg-white text-black/60",
                      ].join(" ")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
                {DAYS.map((d) => {
                  const active = d.day === selectedDay.day && d.label === selectedDay.label;
                  return (
                    <button
                      key={`${d.label}-${d.day}`}
                      type="button"
                      onClick={() => setSelectedDay(d)}
                      className={[
                        "rounded-2xl border px-4 py-4 text-left shadow-sm",
                        active
                          ? "border-black/20 bg-white"
                          : "border-transparent bg-[#efe1d0] hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="text-[11px] font-semibold text-black/60">{d.label}</div>
                      <div className="mt-1 text-[22px] font-semibold text-black">{d.day}</div>
                      <div className="mt-1 text-[11px] font-semibold text-black/50">{d.dow}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  "09:00",
                  "10:00",
                  "11:00",
                  "13:00",
                  "14:00",
                  "15:00",
                  "16:00",
                ].map((t) => {
                  const active = t === time;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className={[
                        "rounded-xl border px-4 py-3 text-[12px] font-semibold tracking-[0.14em]",
                        active
                          ? "border-black/20 bg-white"
                          : "border-transparent bg-[#efe1d0] hover:bg-white",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* summary card */}
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/50">
                Rencana Treatment
              </div>
              <div className="mt-2 text-[18px] font-semibold text-black">{title}</div>
              <div className="mt-4 space-y-2 text-[12px] text-black/70">
                <div>
                  <span className="font-semibold text-black/80">Therapist:</span> {therapist}
                </div>
                <div>
                  <span className="font-semibold text-black/80">Date Booking:</span> {dateLabel}
                </div>
                <div>
                  <span className="font-semibold text-black/80">Time Booking:</span> {time}
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-[#f8efe7] px-4 py-4">
                <div className="flex items-center justify-between text-[12px] text-black/70">
                  <span>Total Price</span>
                  <span className="font-semibold text-black">THB {price}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate("/booking", {
                    state: {
                      service,
                      booking: {
                        dateLabel,
                        time,
                      },
                    },
                  })
                }
                className="mt-6 h-11 w-full rounded-md bg-[#a39373] text-[12px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-[#b4a279]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
