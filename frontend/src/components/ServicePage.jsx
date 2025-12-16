import ServiceCard from "./ServiceCard";
import { services } from "../data/service";

export default function ServicesPage() {
  return (
    <main className="page">
      <section className="servicesSection">
        <div className="sectionTitleBox">
          <h2 className="sectionTitle">Services</h2>
        </div>

        <div className="grid">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </section>
    </main>
  );
}
