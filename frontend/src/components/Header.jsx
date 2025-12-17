import { useEffect, useState } from "react";
import logo from "../assets/rhc-logo.png";

const NAV = [
  { key: "home", label: "HOME", href: "#home" },
  { key: "blog", label: "BLOG", href: "#blog" },
  { key: "services", label: "SERVICES", href: "#services" },
];

export default function Header() {
  const [activeKey, setActiveKey] = useState(() => {
    const raw = window.location.hash?.replace("#", "").toLowerCase();
    return raw || "services";
  });

  useEffect(() => {
    const onHashChange = () => {
      const raw = window.location.hash?.replace("#", "").toLowerCase();
      setActiveKey(raw || "services");
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <header className="w-full bg-white border-b border-black/10">
      <div className="mx-auto flex max-w-[1980px] flex-col items-center px-6 py-10">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-[#b9ab93]">
            <img
              className="h-full w-full object-cover"
              src={logo}
              alt="Refine Haus Clinic"
            />
          </div>

          <div className="font-luxury text-left uppercase leading-[1.05] tracking-[0.18em] text-black">
            <div className="text-[28px]">REFINE HAUS</div>
            <div className="text-[28px]">CLINIC</div>
          </div>
        </div>

        <nav className="mt-8 flex items-center justify-center gap-10 text-[12px] uppercase tracking-[0.28em] text-black">
          {NAV.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <a
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveKey(item.key)}
                className={[
                  "border-b pb-1 transition-colors",
                  isActive ? "border-black" : "border-transparent",
                  "hover:border-black/60",
                ].join(" ")}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
