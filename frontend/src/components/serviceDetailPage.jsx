import { useNavigate, useParams } from "react-router-dom";

export default function ServiceDetailPage() {
  const { serviceKey } = useParams();
  const navigate = useNavigate();

  // Legacy page - now using CategoryDetailPage instead
  const service = {
    key: serviceKey,
    title: "Anti Acne Facial",
    price: 3460,
    duration: "01h 30m",
    therapist: "Dr Napat",
    description:
      "A treatment focused on reducing acne, calming inflammation, and preventing future breakouts. It usually includes deep cleansing, exfoliation, steam, comedone extraction, antibacterial mask, and oil-control finishing products.",
  };

  return (
    <section className="bg-[#d8cfb2] px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid gap-10 lg:grid-cols-[420px_1fr] lg:items-center">
          {/* left card */}
          <div className="rounded-[26px] bg-[#f7e8ea] p-8 shadow-sm">
            <div className="mx-auto grid h-72 w-72 place-items-center overflow-hidden rounded-full border-[10px] border-white bg-white">
              {/* service.image is optional. If your SERVICES has images, render it. */}
              {service?.image ? (
                <img className="h-full w-full object-cover" src={service.image} alt={service.title} />
              ) : (
                <div className="text-center text-[12px] uppercase tracking-[0.24em] text-black/40">
                  image
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="font-luxury text-[22px] text-black">{service.title}</div>
              <div className="mt-1 text-[12px] tracking-[0.12em] text-black/70">
                THB. {service.price}
              </div>
              <div className="mt-2 text-[12px] text-black/60">⏱ {service.duration}</div>
            </div>
          </div>

          {/* right info */}
          <div className="rounded-[30px] bg-[#9e8f6d] px-10 py-10 text-black shadow-sm">
            <div className="text-[16px] leading-relaxed text-black/90">
              {service.description}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="text-[28px] font-semibold">Beauty Link</div>
                <div className="mt-2 text-[12px] text-black/70">
                  📍 Jl. Siliwangi Jl. Ringroad Barat, Area Sawah, Banyuraden, Kec.
                  Gamping
                </div>
                <div className="mt-1 text-[12px] text-black/70">👤 {service.therapist}</div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/booking-time", { state: { service } })}
                className="h-11 w-full rounded-md bg-[#b6a77f] text-[12px] font-semibold uppercase tracking-[0.22em] text-black shadow-sm hover:bg-[#c2b28a] sm:w-56"
              >
                Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
