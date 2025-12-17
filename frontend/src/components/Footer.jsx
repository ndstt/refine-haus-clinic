export default function Footer(){
  return (
    <footer className="mt-10 bg-gradient-to-b from-[#b3a38f] to-[#9b8a74] text-white/90">
      <div className="mx-auto max-w-6xl px-6 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h3 className="text-2xl font-serif mb-3 text-white">Contact</h3>
          <p className="text-sm leading-relaxed text-white/80">
            +66 093 498 2391<br />
            refinehausclinic@gmail.com
          </p>
          <p className="text-sm leading-relaxed mt-4 text-white/80">
            129 Sukhumvit 42 Road, Phra Khanong<br />
            Subdistrict, Khlong Toei District, Bangkok<br />
            10110, Thailand
          </p>
        </div>

        <div>
          <h3 className="text-2xl font-serif mb-3 text-white">Quick Links</h3>
          <div className="text-sm leading-relaxed text-white/80 flex flex-col gap-2">
            <a href="#" className="hover:text-white transition">Services</a>
            <a href="#" className="hover:text-white transition">Contact</a>
            <a href="#" className="hover:text-white transition">Customer Service</a>
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <h3 className="text-2xl font-serif mb-3 text-white">Refine Haus Clinic</h3>
          <p className="text-sm leading-relaxed text-white/80">
            A calm, curated space for high-quality skincare treatments.
          </p>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-serif tracking-wide text-white">REFINE HAUS CLINIC</div>
          <div className="text-xs text-white/70">© {new Date().getFullYear()} Refine Haus Clinic. All rights reserved.</div>
        </div>
      </div>
    </footer>
  )
}
