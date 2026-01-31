import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function ReceiptPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const treatments = location.state?.treatments || [];
  const totalPrice = location.state?.totalPrice || 0;
  const booking = location.state?.booking;

  const [invoiceNo, setInvoiceNo] = useState(null);
  const saveAttempted = useRef(false);

  const dateBooking = booking?.dateBooking ?? "-";
  const timeBooking = booking?.timeBooking ?? "-";
  const customerName = booking?.name ?? "-";
  const customerId = booking?.customerId ?? "-";
  const note = booking?.note ?? "";

  const totalItems = treatments.reduce((sum, t) => sum + (t.quantity || 1), 0);

  // Save to database on mount (only once)
  useEffect(() => {
    if (saveAttempted.current || treatments.length === 0) return;
    saveAttempted.current = true;

    const saveBooking = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/v1/booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            treatments: treatments.map((t) => ({
              treatment_id: t.treatment_id,
              price: t.price,
              quantity: t.quantity || 1,
            })),
            customer_name: customerName,
            customer_id: customerId,
            session_date: dateBooking,
            session_time: timeBooking,
            note: note,
            total_amount: totalPrice,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setInvoiceNo(data.invoice_no);
        }
      } catch (error) {
        console.error("Failed to save booking:", error);
      }
    };

    saveBooking();
  }, [treatments, customerName, customerId, dateBooking, timeBooking, note, totalPrice]);

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
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-semibold text-black">Detail Success</div>
              {invoiceNo && (
                <div className="text-[12px] text-black/60">Invoice: {invoiceNo}</div>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[13px] text-black/80">
                <thead>
                  <tr className="text-[12px] uppercase tracking-[0.12em] text-black/50">
                    <th className="pb-3 font-semibold">TREATMENT</th>
                    <th className="pb-3 font-semibold text-center">QTY</th>
                    <th className="pb-3 font-semibold">PRICE</th>
                    <th className="pb-3 font-semibold">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((item) => {
                    const qty = item.quantity || 1;
                    const itemTotal = (item.price || 0) * qty;
                    return (
                      <tr key={item.treatment_id} className="border-t border-black/5">
                        <td className="py-2">{item.name}</td>
                        <td className="py-2 text-center">{qty}</td>
                        <td className="py-2">THB {item.price?.toLocaleString()}</td>
                        <td className="py-2 font-semibold">THB {itemTotal.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-black/20">
                    <td className="py-3 font-semibold" colSpan={3}>
                      Total ({totalItems} items)
                    </td>
                    <td className="py-3 text-[14px] font-semibold text-[#9b7a2f]">
                      THB {totalPrice.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid gap-4 rounded-xl bg-[#f8efe7] px-5 py-4 text-[12px] text-black/70 sm:grid-cols-2">
              <div>
                <div>
                  <span className="font-semibold text-black/80">Customer Name:</span> {customerName}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">Customer ID:</span> {customerId}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">Date Booking:</span> {dateBooking}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">Time:</span> {timeBooking}
                </div>
              </div>
              <div>
                <div>
                  <span className="font-semibold text-black/80">Treatments:</span> {totalItems} item(s)
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">TOTAL PAYMENT (THB):</span> {totalPrice.toLocaleString()}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-black/80">Visit type:</span> BOOKING
                </div>
                {note && (
                  <div className="mt-1">
                    <span className="font-semibold text-black/80">Note:</span> {note}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 text-[11px] leading-relaxed text-black/60">
              Thank you for booking with Refine Haus Clinic. Please arrive 10 minutes before your appointment.
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
