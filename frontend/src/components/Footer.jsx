export default function Footer() {
  return (
    <footer className="relative bg-[#b7a892] text-white/90">
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <h3 className="font-serif text-3xl font-medium">Contact Details</h3>
          <p className="mt-4 text-xs leading-6 text-white/85">
            +66 093 498 2391 <br />
            REFINE HAUS CLINIC <br />
            refinehausclinic@gmail.com <br /><br />
            129 Sukhumvit 42 Road, Phra Khanong <br />
            Subdistrict, Khlong Toei District, Bangkok <br />
            10110, Thailand
          </p>
        </div>

        <div className="md:text-right">
          <h3 className="font-serif text-3xl font-medium">Quick Links</h3>
          <p className="mt-4 text-xs leading-6 text-white/85">
            Contact <br />
            Customer Service
          </p>
        </div>
      </div>

      <div className="pointer-events-none hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-3 opacity-40">
        <div className="h-10 w-10 rounded-full bg-white/60" />
        <div className="font-serif tracking-wide">
          <div className="text-sm font-semibold">REFINE HAUS</div>
          <div className="text-sm font-semibold">CLINIC</div>
        </div>
      </div>
    </footer>
  );
}
