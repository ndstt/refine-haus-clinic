import { SERVICES } from "../data/service";
import ServiceCard from "./serviceCard";

export default function ServicePage() {
  return (
    <section id="services" className="bg-[#E6D4B9] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="relative z-10 mx-auto w-full max-w-205 bg-white py-5 text-center shadow-sm">
          <h2 className="font-luxury text-[26px] tracking-[0.12em] text-[#9b7a2f]">
            Services
          </h2>
        </div>

        <div className="mx-auto -mt-6 bg-[#f8efe7] px-8 pb-12 pt-14 sm:px-12 sm:pb-16">
          <div className="grid grid-cols-1 place-items-center gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service) => (
              <ServiceCard
                key={service.key}
                category={service.category}
                title={service.title}
                price={service.price}
                image={service.image}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

