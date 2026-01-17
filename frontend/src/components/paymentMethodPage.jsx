import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const METHODS = [
  "BCA Virtual Account",
  "Mandiri Virtual Account",
  "BRI Virtual Account",
  "SHOPEEPAY",
  "Gopay",
  "DANA",
  "BNI Virtual Account",
];

export default function PaymentMethodPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const service = location.state?.service;
  const booking = location.state?.booking;

  const [method, setMethod] = useState("SHOPEEPAY");
  const title = service?.title ?? "Anti Facial Acne";
  const amount = service?.price ?? 4160;

  return (
    <section className="bg-[#E6D4B9] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[920px]">
        <div className="mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Payment Method
          </h2>
        </div>

        <div className="mx-auto -mt-6 rounded-2xl bg-[#f8efe7] px-8 pb-10 pt-12 sm:px-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[14px] font-semibold text-black">Pilih Metode Pembayaran</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {METHODS.map((m) => {
                  const active = m === method;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={[
                        "rounded-xl border px-4 py-3 text-left text-[12px] font-semibold tracking-[0.06em]",
                        active
                          ? "border-black/20 bg-white"
                          : "border-transparent bg-[#efe1d0] hover:bg-white",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 text-[11px] leading-relaxed text-black/60">
                Dengan mengetuk <span className="font-semibold">BAYAR</span>, Saya setuju untuk
                melanjutkan transaksi menggunakan <span className="font-semibold">{method}</span>
                .
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/50">
                Top Up
              </div>
              <div className="mt-2 text-[16px] font-semibold text-black">{title}</div>
              <div className="mt-4 rounded-xl bg-[#f8efe7] px-4 py-4">
                <div className="flex items-center justify-between text-[12px] text-black/70">
                  <span>Amount</span>
                  <span className="font-semibold text-black">THB {amount}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate("/success", {
                    state: { service, booking, payment: { method, amount } },
                  })
                }
                className="mt-6 h-11 w-full rounded-md bg-[#a39373] text-[12px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-[#b4a279]"
              >
                Bayar
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
