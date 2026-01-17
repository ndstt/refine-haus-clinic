import logo from "../assets/rhc-logo.png";

export default function Footer() {
  return (
    <footer id="contact" className="w-full bg-[#b19e87dd] text-white">
      <div className="mx-auto max-w-[495px] px-6 py-16 sm:py-20">
        <div className="grid gap-14 lg:grid-cols-3 lg:items-start">
          <div>
            <h2 className="font-luxury text-[44px] leading-none tracking-[0.02em] sm:text-[54px]">
              Contact Details
            </h2>

            <div className="mt-10 space-y-1 text-[14px] leading-relaxed text-white/90 sm:text-[15px]">
              <div>(+66) 083 423 9329</div>
              <div className="font-semibold uppercase tracking-[0.04em]">
                CV. REFINE HAUS CLINIC
              </div>
              <a
                className="hover:underline hover:underline-offset-4"
                href="mailto:refinehausclinic@gmail.com"
              >
                refinehausclinic@gmail.com
              </a>
              <div>1282/2 Mittraphap Road, Nai Mueng Subdistrict</div>
              <div>Mueng Nakhon Ratchasima District, Nakhon Ratchasima</div>
              <div>30000, Thailand</div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:pt-14">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-[#a89c86]">
                <img
                  className="h-full w-full object-cover opacity-90"
                  src={logo}
                  alt="Refine Haus Clinic"
                />
              </div>

              <div className="font-luxury text-left uppercase leading-[1.05] tracking-[0.18em] text-black">
                <div className="text-[28px]">REFINE HAUS</div>
                <div className="text-[28px]">CLINIC</div>
              </div>
            </div>
          </div>

          <div className="lg:text-right">
            <h2 className="font-luxury text-[44px] leading-none tracking-[0.02em] sm:text-[54px]">
              Socials
            </h2>

            <div className="mt-10 space-y-3 text-[16px] text-white/90">
              <a
                className="inline-block hover:underline hover:underline-offset-4"
                href="https://www.facebook.com/p/RefineHaus-Clinic-61567065729399/"
                target="_blank"
                rel="noreferrer"
              >
                Facebook
              </a>
              <div>
                <a
                  className="inline-block hover:underline hover:underline-offset-4"
                  href="https://www.instagram.com/refinehaus.clinic"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </div>
              <div>
                <a
                  className="inline-block hover:underline hover:underline-offset-4"
                  href="https://www.tiktok.com/@refinehaus.clinic"
                  target="_blank"
                  rel="noreferrer"
                >
                  TikTok
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-[13px] text-white/80">
          Copyright © 2025 CV. REFINE HAUS CLINIC
        </div>
      </div>
    </footer>
  );
}
