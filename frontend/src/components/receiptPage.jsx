import { useLocation, useNavigate } from "react-router-dom";

export default function ReceiptPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const service = location.state?.service;
  const booking = location.state?.booking;
  const payment = location.state?.payment;

  const title = service?.title ?? "Anti Facial Acne";
  const price = payment?.amount ?? service?.price ?? 4160;
  const dateLabel = booking?.dateLabel ?? "25-05-2025";
  const time = booking?.time ?? "10:00";
  const name = booking?.name ?? "Athipat D.";

  return (
    <section className="bg-[#E6D4B9] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Receipt
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-2xl bg-[#f8efe7] px-8 pb-10 pt-12 sm:px-12">
          <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
            <div className="text-[14px] font-semibold text-black">Detail Success</div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[13px] text-black/80">
                <thead>
                  <tr className="text-[12px] uppercase tracking-[0.12em] text-black/50">
                    <th className="pb-3 font-semibold">TREATMENT</th>
                    <th className="pb-3 font-semibold">PRICE</th>
                    <th className="pb-3 font-semibold">DISC</th>
                    <th className="pb-3 font-semibold">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-black/5">
                    <td className="py-2">{title}</td>
                    <td className="py-2">{price}</td>
                    <td className="py-2">0</td>
                    <td className="py-2 font-semibold">{price}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid gap-4 rounded-xl bg-[#f8efe7] px-5 py-4 text-[12px] text-black/70 sm:grid-cols-2">
              <div>
                <div>
                  <span className="font-semibold text-black/80">Date Booking:</span> {dateLabel}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">Time:</span> {time}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">Name:</span> {name}
                </div>
              </div>
              <div>
                <div>
                  <span className="font-semibold text-black/80">Payment:</span> {payment?.method ?? "SHOPEEPAY"}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">TOTAL PAYMENT (THB):</span> {price}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">Visit type:</span> BOOKING
                </div>
              </div>
            </div>

            <div className="mt-5 text-[11px] leading-relaxed text-black/60">
              Untuk penjelasan treatment lebih lanjut akan dijelaskan jika sudah diklinik.
            </div>

            <button
              type="button"
              onClick={() => navigate("/services")}
              className="mt-6 h-11 w-full rounded-md border border-black/20 bg-white text-[12px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-black hover:text-white"
            >
              Back to Services
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
