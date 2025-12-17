import logo from '../assets/rfc-logo.jpg'

export default function Header(){
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <a href="#" className="flex items-center gap-5 no-underline text-black visited:text-black hover:text-black">
          <div className="pr-[8px] overflow-hidden">
            <img src={logo} alt="Refine Haus Clinic logo" className="h-[50px] w-[50px] rounded-full object-cover" />
          </div>
          <div className="font-serif leading-none">
            <div className="text-xl font-semibold tracking-wide">REFINE HAUS</div>
            <div className="text-xl font-semibold tracking-wide">CLINIC</div>
          </div>
        </a>

        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium uppercase tracking-wider">
          <a
            href="#"
            className="rounded-full px-4 py-2 text-black visited:text-black no-underline hover:bg-black/5 transition-colors"
          >
            Home
          </a>
          <a
            href="#"
            className="rounded-full px-4 py-2 text-black visited:text-black no-underline hover:bg-black/5 transition-colors"
          >
            Blog
          </a>
          <a
            href="#"
            aria-current="page"
            className="rounded-full px-4 py-2 text-black visited:text-black no-underline hover:bg-black/5 transition-colors"
          >
            Services
          </a>
        </nav>
      </div>
    </header>
  )
}
