import { NavLink, useNavigate } from "react-router-dom";
import rhcLogo from "../assets/rhc-logo.png";
import { useCart } from "../context/CartContext";

const NAV = [
  { key: "dashboard", label: "DASHBOARD", to: "/dashboard" },
  { key: "customer", label: "CUSTOMER", to: "/customer" },
  { key: "services", label: "SERVICES", to: "/services" },
  { key: "promotion", label: "PROMOTION", to: "/promotion" },
  { key: "appointment", label: "APPOINTMENT", to: "/appointment" },
  { key: "inventory", label: "INVENTORY", to: "/inventory" },
  { key: "lumina", label: "LUMINA", to: "/lumina" },
];

export default function Header() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const cartCount = getCartCount();

  return (
    <header className="w-full bg-white">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-6 pb-10 pt-12 sm:pb-12 sm:pt-14">
        <div className="flex items-center justify-center gap-5 sm:gap-6">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#b9ab93] sm:h-20 sm:w-20">
            <img
              src={rhcLogo}
              alt="Refine Haus Clinic"
              className="h-full w-full object-cover"
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

        <nav className="mt-10 flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 font-luxury text-[12px] uppercase tracking-[0.22em] text-black sm:mt-12 sm:gap-x-10 sm:text-[13px] md:gap-x-12 md:text-[14px]">
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

          {/* Cart Icon */}
          <button
            type="button"
            onClick={() => navigate("/cart")}
            className="relative pb-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#9b7a2f] text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
