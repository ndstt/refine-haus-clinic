import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function BookingFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const service = location.state?.service;
  const booking = location.state?.booking;

  const [name, setName] = useState("Athipat D.");
  const [note, setNote] = useState("");

  const title = service?.title ?? "Anti Facial Acne";
  const therapist = service?.therapist ?? "Dr Napat";
  const price = service?.price ?? 4160;
  const dateLabel = booking?.dateLabel ?? "25 May 2025";
  const time = booking?.time ?? "10:00";

  return (
    <section className="bg-[#E6D4B9] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Booking
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-2xl bg-[#f8efe7] px-8 pb-10 pt-12 sm:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                  Name
                  <input
                    className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                  Therapist
                  <input
                    className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                    value={therapist}
                    readOnly
                  />
                </label>

                <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                  Date Booking
                  <input
                    className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                    value={dateLabel}
                    readOnly
                  />
                </label>

                <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                  Time Booking
                  <input
                    className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                    value={time}
                    readOnly
                  />
                </label>
              </div>

              <label className="mt-5 flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                Information (Optional)
                <textarea
                  className="min-h-28 rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Please inform here"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/50">
                Summary
              </div>
              <div className="mt-2 text-[18px] font-semibold text-black">{title}</div>

              <div className="mt-5 space-y-2 text-[12px] text-black/70">
                <div className="flex items-center justify-between">
                  <span>Total Price</span>
                  <span className="font-semibold text-black">THB {price}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Paid</span>
                  <span className="font-semibold text-black">—</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate("/payment", {
                    state: {
                      service,
                      booking: { dateLabel, time, name, note },
                    },
                  })
                }
                className="mt-6 h-11 w-full rounded-md bg-[#a39373] text-[12px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-[#b4a279]"
              >
                Choose Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
