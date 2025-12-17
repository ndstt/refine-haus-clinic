import cardBg from "../assets/service-bg.jpg";

export default function ServiceCard({ category = "Treatment", title, price, image }) {
  return (
    <article className="w-full max-w-55">
      <div
        className="relative flex aspect-260/260 w-full items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${cardBg})` }}
      >
        <div className="h-40 w-40 overflow-hidden bg-white shadow-sm ring-1 ring-black/10">
          <img
            className="h-full w-full object-cover"
            src={image}
            alt={title}
            loading="lazy"
          />
        </div>
      </div>

      <div className="mt-3 text-left">
        <div className="text-[11px] uppercase tracking-[0.18em] text-black/60">
          {category}
        </div>
        <h3 className="mt-1 font-luxury text-[22px] leading-tight text-black">
          {title}
        </h3>
        <div className="mt-1 text-[12px] tracking-[0.12em] text-black/70">
          THB. {price}
        </div>
      </div>
    </article>
  );
}

