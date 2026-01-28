import { useMemo, useState } from "react";

const SIDEBAR_ITEMS = [
  { key: "item-list", label: "Item List" },
  { key: "import-items", label: "Import" },
  { key: "withdraw-items", label: "Withdraw" },
];

const INVENTORY_ITEMS = [
  {
    code: "MED-NABU-100",
    name: "Nabuto",
    variant: "100u",
    type: "Medicine",
    quantity: 10,
    status: "Ready",
    price: 45,
    unit: "u",
  },
  {
    code: "MED-XEOM-50",
    name: "Xeomin",
    variant: "50u",
    type: "Medicine",
    quantity: 8,
    status: "Low",
    price: 55,
    unit: "u",
  },
  {
    code: "MED-DERM-50",
    name: "Derma Glow",
    variant: "50cc",
    type: "Medicine",
    quantity: 99,
    status: "Ready",
    price: 70,
    unit: "cc",
  },
  {
    code: "MED-NEUR-50",
    name: "Neuramis",
    variant: "50u",
    type: "Medicine",
    quantity: 50,
    status: "Ready",
    price: 48,
    unit: "u",
  },
  {
    code: "MED-REJU-50",
    name: "Rejuran",
    variant: "20u",
    type: "Medicine",
    quantity: 60,
    status: "Low",
    price: 32,
    unit: "cc",
  },
  {
    code: "TOOL-LASE-B",
    name: "Laser Tip",
    variant: "B",
    type: "Tool",
    quantity: 67,
    status: "Ready",
    price: 40,
    unit: "piece",
  },
  {
    code: "TOOL-SYRI-1",
    name: "Syringe 1cc",
    variant: "1cc",
    type: "Tool",
    quantity: 200,
    status: "Ready",
    price: 1200,
    unit: "piece",
  },
  {
    code: "TOOL-SYRI-2",
    name: "Needle 30G",
    variant: "2cc",
    type: "Tool",
    quantity: 800,
    status: "Ready",
    price: 12,
    unit: "piece",
  },
  {
    code: "TOOL-COTT-X",
    name: "Cotton Ball",
    variant: "X",
    type: "Tool",
    quantity: 632,
    status: "Ready",
    price: 8,
    unit: "piece",
  },
  {
    code: "TOOL-GAUZ-Z",
    name: "Gauze",
    variant: "Z",
    type: "Tool",
    quantity: 120,
    status: "Low",
    price: 120,
    unit: "piece",
  },
  {
    code: "TOOL-ALCO-88",
    name: "Alcohol Pad",
    variant: "88",
    type: "Tool",
    quantity: 500,
    status: "Low",
    price: 95,
    unit: "piece",
  },
  {
    code: "TOOL-TISS-A",
    name: "Tissue",
    variant: "A",
    type: "Tool",
    quantity: 412,
    status: "Low",
    price: 180,
    unit: "piece",
  },
];

const STATUS_STYLES = {
  Ready: "bg-[#e7efe4] text-[#3f6b4c] border-[#cfe0c7]",
  Low: "bg-[#f6e6e3] text-[#8a3b30] border-[#e7c6bf]",
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
      {label}
      {children}
    </label>
  );
}

function ToggleIcon() {
  // icon แบบเดียวกับที่มึงใช้ใน Lumina (ปุ่มยุบ/ขยาย)
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="6.5"
        y="5.5"
        width="11"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 8h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavIcon({ kind }) {
  // ไอคอนให้เหมือนรูป: cube / import box / withdraw box
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (kind === "item-list") {
    // cube
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" {...common}>
        <path d="M12 2 3 7l9 5 9-5-9-5Z" />
        <path d="M3 7v10l9 5 9-5V7" />
        <path d="M12 12v10" />
      </svg>
    );
  }

  if (kind === "import-items") {
    // open box + down arrow
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" {...common}>
        <path d="M3 9l9-5 9 5" />
        <path d="M3 9v10h18V9" />
        <path d="M12 11v6" />
        <path d="M9.5 14.5 12 17l2.5-2.5" />
        <path d="M8 9h8" />
      </svg>
    );
  }

  // withdraw-items: open box + up arrow
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" {...common}>
      <path d="M3 9l9-5 9 5" />
      <path d="M3 9v10h18V9" />
      <path d="M12 17v-6" />
      <path d="M9.5 13.5 12 11l2.5 2.5" />
      <path d="M8 9h8" />
    </svg>
  );
}

function getTitle(activeTab) {
  if (activeTab === "import-items") return "Import";
  if (activeTab === "withdraw-items") return "Withdraw";
  return "Item List";
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("item-list");
  const [collapsed, setCollapsed] = useState(false);

  const [filters, setFilters] = useState({
    code: "",
    name: "",
    variant: "",
    type: "All",
    status: "All",
    price: "",
    unit: "",
  });

  const filteredItems = useMemo(() => {
    return INVENTORY_ITEMS.filter((item) => {
      const codeOk = filters.code.trim()
        ? item.code.toLowerCase().includes(filters.code.trim().toLowerCase())
        : true;
      const nameOk = filters.name.trim()
        ? item.name.toLowerCase().includes(filters.name.trim().toLowerCase())
        : true;
      const variantOk = filters.variant.trim()
        ? item.variant.toLowerCase().includes(filters.variant.trim().toLowerCase())
        : true;
      const typeOk = filters.type === "All" ? true : item.type === filters.type;
      const statusOk =
        filters.status === "All" ? true : item.status === filters.status;
      return codeOk && nameOk && variantOk && typeOk && statusOk;
    });
  }, [filters]);

  return (
    <section className="bg-[#f6eadb] px-6 py-10">
      <div className="mx-auto flex w-full max-w-[1200px]">
        {/* Sidebar (collapse/expand) */}
        <aside
          className={[
            "border-r border-black/10 bg-[#f6eadb] transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-[240px]",
          ].join(" ")}
        >
          {/* top header row */}
          <div
            className={[
              "pt-6 flex items-center",
              collapsed ? "px-2 justify-center" : "px-6 justify-between",
            ].join(" ")}
          >
            {!collapsed && (
              <div className="font-luxury text-[22px] uppercase tracking-[0.18em] text-black">
                INVENTORY
              </div>
            )}

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full text-black/50 hover:bg-black/5"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              <ToggleIcon />
            </button>
          </div>

          {/* nav */}
          {collapsed ? (
            // collapsed: icon only
            <div className="mt-8 flex flex-col items-center gap-3 pb-10">
              {SIDEBAR_ITEMS.map((item) => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={[
                      "grid h-12 w-12 place-items-center rounded-2xl",
                      active
                        ? "bg-white border border-black/20"
                        : "hover:bg-black/5",
                    ].join(" ")}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <span className={active ? "text-black/70" : "text-black/55"}>
                      <NavIcon kind={item.key} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            // expanded: icon + label
            <div className="mt-6 px-4 pb-10">
              <div className="space-y-1">
                {SIDEBAR_ITEMS.map((item) => {
                  const active = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      className={[
                        "w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left",
                        active
                          ? "bg-white border border-black/15"
                          : "hover:bg-black/5",
                      ].join(" ")}
                    >
                      <span className={active ? "text-black/70" : "text-black/55"}>
                        <NavIcon kind={item.key} />
                      </span>
                      <span className="text-[18px] text-black/80">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 px-8 py-6">
          <div>
            <h1 className="text-[24px] font-semibold text-black">
              {getTitle(activeTab)}
            </h1>
            <p className="mt-1 text-[13px] text-black/60">
              Checking items information and amount
            </p>
          </div>

          {activeTab === "item-list" ? (
            <>
              {/* Search & Filter card */}
              <div className="mt-4 rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-sm">
                <div className="text-[13px] font-semibold text-black">
                  Search and Filter
                </div>
                <p className="mt-1 text-[12px] text-black/50">
                  Search and Filter by condition you want
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-5">
                  <Field label="Item Code">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={filters.code}
                      onChange={(e) =>
                        setFilters((s) => ({ ...s, code: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Item Name">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={filters.name}
                      onChange={(e) =>
                        setFilters((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Item Variant">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={filters.variant}
                      onChange={(e) =>
                        setFilters((s) => ({ ...s, variant: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Item Type">
                    <select
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px] text-black/70"
                      value={filters.type}
                      onChange={(e) =>
                        setFilters((s) => ({ ...s, type: e.target.value }))
                      }
                    >
                      <option>All</option>
                      <option>Medicine</option>
                      <option>Tool</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px] text-black/70"
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((s) => ({ ...s, status: e.target.value }))
                      }
                    >
                      <option>All</option>
                      <option>Ready</option>
                      <option>Low</option>
                    </select>
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:max-w-[420px]">
                    <Field label="Sell Price / Piece">
                      <input
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={filters.price}
                        onChange={(e) =>
                          setFilters((s) => ({ ...s, price: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Unit">
                      <input
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={filters.unit}
                        onChange={(e) =>
                          setFilters((s) => ({ ...s, unit: e.target.value }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="ml-auto">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full bg-[#f3e5d6] px-8 py-1.5 text-[12px] font-semibold text-black/80"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              {/* Item list table */}
              <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="text-[13px] font-semibold text-black">
                  Item List ({filteredItems.length})
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-[12px] text-black/80">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.12em] text-black/50">
                        <th className="pb-3 font-semibold">Code</th>
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Variant</th>
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Quantity</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Sell Price / Piece</th>
                        <th className="pb-3 font-semibold">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr key={item.code} className="border-t border-black/5">
                          <td className="py-2 whitespace-nowrap">{item.code}</td>
                          <td className="py-2 whitespace-nowrap">{item.name}</td>
                          <td className="py-2 whitespace-nowrap">{item.variant}</td>
                          <td className="py-2 whitespace-nowrap">{item.type}</td>
                          <td className="py-2 whitespace-nowrap">{item.quantity}</td>
                          <td className="py-2">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                                STATUS_STYLES[item.status] ??
                                  "border-black/10 text-black/70",
                              ].join(" ")}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2 whitespace-nowrap">{item.price}</td>
                          <td className="py-2 whitespace-nowrap">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            // Import/Withdraw placeholder (มึงจะต่อฟอร์มละเอียดทีหลังได้)
            <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[14px] font-semibold text-black">
                {activeTab === "import-items" ? "Import Items" : "Withdraw Items"}
              </div>
              <p className="mt-2 text-[12px] text-black/50">
                หน้านี้เป็น placeholder ก่อน — ถ้ามึงอยากให้กูทำฟอร์ม Import/Withdraw
                ให้เหมือนใน PDF เป๊ะๆ กูจัดให้ได้เลย
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
