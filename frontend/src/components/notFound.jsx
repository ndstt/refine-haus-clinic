import { Link, useLocation } from "react-router-dom";

export default function NotFound({ label }) {
  const location = useLocation();

  const description = label
    ? `${label} page isn't ready yet.`
    : `No page found at "${location.pathname}".`;

  return (
    <section className="bg-white px-6 py-24 sm:py-28">
      <div className="mx-auto max-w-205 text-center">
        <div className="font-luxury text-[72px] leading-none tracking-[0.06em] text-black sm:text-[84px]">
          404
        </div>
        <h1 className="mt-4 font-luxury text-[28px] uppercase tracking-[0.12em] text-black sm:text-[34px]">
          Page Not Found
        </h1>
        <p className="mt-3 text-[14px] text-black/70 sm:text-[15px]">
          {description}
        </p>

        <Link
          to="/services"
          className="mt-10 inline-flex items-center justify-center border border-black px-6 py-3 text-[12px] uppercase tracking-[0.28em] text-black transition-colors hover:bg-black hover:text-white"
        >
          Back To Services
        </Link>
      </div>
    </section>
  );
}

