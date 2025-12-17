export default function ServiceCard({ service }) {
  const { category, title, price, image } = service;

  return (
    <article className="flex flex-col gap-2">
      <div className="bg-[#caa07f] p-4">
        <img
          src={image}
          alt={title}
          className="w-full aspect-square object-cover border-[3px] border-white/70"
          loading="lazy"
        />
      </div>

      <div className="px-1">
        <div className="text-[11px] text-black/55">{category}</div>
        <div className="mt-1 text-sm font-semibold text-black/85">{title}</div>
        <div className="mt-1 text-xs text-black/70">
          THB. {price.toLocaleString("th-TH")}
        </div>
      </div>
    </article>
  );
}
