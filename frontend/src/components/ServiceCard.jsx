import frame from '../assets/image-5.svg'

export default function ServiceCard({service}){
  const {category,title,price,image} = service
  const imageSrc =
    typeof image === 'string'
      ? image
      : image && typeof image === 'object'
        ? Object.values(image)[0]
        : undefined

  return (
    <article className="group rounded-2xl bg-white/70 border border-black/5 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-4">
        <div
          className="w-full aspect-square grid place-items-center bg-center bg-no-repeat rounded-xl bg-white/60 ring-1 ring-black/5"
          style={{backgroundImage:`url(${frame})`, backgroundSize:'74%'}}
        >
          {imageSrc ? (
            <img
              className="w-3/4 aspect-square object-cover rounded-lg shadow-sm group-hover:scale-[1.02] transition-transform"
              src={imageSrc}
              alt={title}
              loading="lazy"
            />
          ) : (
            <div className="w-3/4 aspect-square rounded-lg bg-black/5 grid place-items-center text-xs text-black/40">
              No image
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="text-[11px] uppercase tracking-wider text-black/45">{category}</div>
        <div className="text-lg font-semibold mt-1 text-black/85 leading-snug">{title}</div>
        <div className="text-sm text-black/60 mt-1">THB {price.toLocaleString('th-TH')}</div>
      </div>
    </article>
  )
}
