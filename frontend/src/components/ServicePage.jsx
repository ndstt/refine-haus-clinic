import ServiceCard from './ServiceCard'
import { services } from '../data/service'

export default function ServicesPage(){
  return (
    <main className="px-6 pt-10 pb-16">
      <section className="mx-auto w-full max-w-6xl rounded-3xl bg-white/50 backdrop-blur border border-white/70 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="px-6 sm:px-10 pt-10 pb-6 bg-[linear-gradient(180deg,rgba(180,136,47,0.10),rgba(255,255,255,0.00))] border-b border-black/5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-amber-950">
                Services
              </h2>
              <p className="mt-2 text-sm sm:text-base text-black/60 max-w-2xl">
                Curated treatments designed for glow, clarity, and long-term skin health.
              </p>
            </div>
            <div className="text-sm text-black/50">
              {services.length} treatments
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
