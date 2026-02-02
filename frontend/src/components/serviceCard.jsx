import { Link } from "react-router-dom";

export default function ServiceCard({
  category,
  title,
  price,
  image,
  to,
}) {
  if (to) {
    return (
      <Link
        to={to}
        className="block w-full max-w-55 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
      >
      <div className="relative flex aspect-260/260 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#efe3d3] via-[#f6eadb] to-[#ead8c0]">
        <div className="h-40 w-40 overflow-hidden bg-white shadow-sm ring-1 ring-black/10">
          {image ? (
            <img
              className="h-full w-full object-cover"
              src={image}
              alt={title}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.2em] text-black/40">
              No Image
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-left">
        {category && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-black/60">
            {category}
          </div>
        )}
        <h3 className="mt-1 font-luxury text-[22px] leading-tight text-black">
          {title}
        </h3>
        {price && (
          <div className="mt-1 text-[12px] tracking-[0.12em] text-black/70">
            THB. {price}
          </div>
        )}
      </div>
      </Link>
    );
  }

  return (
    <div className="block w-full max-w-55">
      <div className="relative flex aspect-260/260 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#efe3d3] via-[#f6eadb] to-[#ead8c0]">
        <div className="h-40 w-40 overflow-hidden bg-white shadow-sm ring-1 ring-black/10">
          {image ? (
            <img
              className="h-full w-full object-cover"
              src={image}
              alt={title}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.2em] text-black/40">
              No Image
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-left">
        {category && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-black/60">
            {category}
          </div>
        )}
        <h3 className="mt-1 font-luxury text-[22px] leading-tight text-black">
          {title}
        </h3>
        {price && (
          <div className="mt-1 text-[12px] tracking-[0.12em] text-black/70">
            THB. {price}
          </div>
        )}
      </div>
    </div>
  );
}
