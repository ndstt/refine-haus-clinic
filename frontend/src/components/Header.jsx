import logo from "../assets/rhc-logo.png";
import { NavLink } from "react-router-dom";

const NAV = [
  { key: "home", label: "HOME", to: "/home" },
  { key: "blog", label: "BLOG", to: "/blog" },
  { key: "services", label: "SERVICES", to: "/services" },
  { key: "inventory", label: "INVENTORY", to: "/inventory" },
  { key: "lumina", label: "LUMINA", to: "/lumina" },
];

export default function Header() {
  return (
    <header className="w-full bg-white">
      <div className="mx-auto flex max-w-495 flex-col items-center px-6 pb-10 pt-12 sm:pb-12 sm:pt-14">
        <div className="flex items-center justify-center gap-5 sm:gap-6">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#b9ab93] sm:h-20 sm:w-20">
            <img
              className="h-full w-full object-cover"
              src={logo}
              alt="Refine Haus Clinic"
            />
          </div>

          <div className="font-luxury text-left uppercase leading-[0.98] tracking-[0.18em] text-black">
            <div className="text-[30px] sm:text-[40px] md:text-[52px]">
              REFINE HAUS
            </div>
            <div className="text-[30px] sm:text-[40px] md:text-[52px]">
              CLINIC
            </div>
          </div>
        </div>

        <nav className="mt-10 flex flex-wrap items-center justify-center gap-x-14 gap-y-4 font-luxury text-[13px] uppercase tracking-[0.28em] text-black sm:mt-12 sm:gap-x-20 sm:text-[14px] md:gap-x-24 md:text-[15px]">
          {NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end
              className={({ isActive }) =>
                [
                  "relative pb-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-black after:origin-left after:transition-transform after:duration-200 after:content-['']",
                  isActive
                    ? "after:scale-x-100"
                    : "after:scale-x-0 hover:after:scale-x-100",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
