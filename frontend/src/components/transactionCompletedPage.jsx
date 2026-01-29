import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function TransactionCompletedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const treatment = location.state?.treatment;
  const booking = location.state?.booking;

  const timestamp = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, []);

  const treatmentName = treatment?.name ?? "Treatment";
  const price = treatment?.price ?? 0;

  return (
    <section className="bg-[#E6D4B9] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Transaction
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-2xl bg-[#f8efe7] px-8 pb-10 pt-12 sm:px-12">
          <div className="rounded-2xl border border-black/10 bg-white px-6 py-8 text-center shadow-sm">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#e7efe4] text-[#3f6b4c]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <div className="mt-6 text-[18px] font-semibold text-black">
              Transaction Completed
            </div>
            <div className="mt-2 text-[12px] text-black/60">{timestamp}</div>

            <div className="mt-6 rounded-xl bg-[#f8efe7] px-5 py-4 text-left">
              <div className="flex items-center justify-between text-[12px] text-black/70">
                <span>Treatment</span>
                <span className="font-semibold text-black">{treatmentName}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-black/70">
                <span>Total Payment (THB)</span>
                <span className="font-semibold text-black">{price?.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-black/70">
                <span>Customer</span>
                <span className="font-semibold text-black">{booking?.name ?? "-"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-black/70">
                <span>Date</span>
                <span className="font-semibold text-black">{booking?.dateBooking ?? "-"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-black/70">
                <span>Time</span>
                <span className="font-semibold text-black">{booking?.timeBooking ?? "-"}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/receipt", {
                  state: { treatment, booking },
                })
              }
              className="mt-8 h-11 w-full max-w-xs rounded-md bg-[#a39373] text-[12px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-[#b4a279]"
            >
              View Receipt
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
