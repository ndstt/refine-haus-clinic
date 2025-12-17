import { services } from "../data/service";
import ServiceCard from "./serviceCard";

export default function ServicesPage() {
  return (
    <main className="bg-[#d7c7a6]">
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="bg-[#f6e7d8] border border-black/10 px-6 py-7">
          <div className="mx-auto mb-7 max-w-2xl bg-white border border-black/10 shadow-[0_10px_22px_rgba(0,0,0,0.12)] text-center py-4">
            <h2 className="font-serif text-lg tracking-wide text-[#b8933e]">Services</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
