import { useEffect, useState } from "react";

const SIDEBAR_ITEMS = [
  { key: "item-list", label: "Item List" },
  { key: "import-items", label: "Import" },
  { key: "withdraw-items", label: "Withdraw" },
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
  const [appliedFilters, setAppliedFilters] = useState({
    code: "",
    name: "",
    variant: "",
    type: "All",
    status: "All",
    price: "",
    unit: "",
  });

  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (activeTab !== "item-list") return;
    const apiBase =
      import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";
    let isMounted = true;
    setIsLoading(true);
    setLoadError("");
    const typeParam =
      appliedFilters.type === "Medicine"
        ? "MEDICINE"
        : appliedFilters.type === "Tool"
          ? "MEDICAL_TOOL"
          : appliedFilters.type;
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
    });
    if (appliedFilters.code) params.set("code", appliedFilters.code);
    if (appliedFilters.name) params.set("name", appliedFilters.name);
    if (appliedFilters.variant) params.set("variant", appliedFilters.variant);
    if (typeParam && typeParam !== "All") params.set("item_type", typeParam);
    if (appliedFilters.status && appliedFilters.status !== "All") {
      params.set("status", appliedFilters.status);
    }
    if (appliedFilters.price) params.set("price", appliedFilters.price);
    if (appliedFilters.unit) params.set("unit", appliedFilters.unit);
    fetch(`${apiBase}/resource/item-catalog?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotalItems(typeof data.total === "number" ? data.total : 0);
        setTotalPages(
          typeof data.total_pages === "number" ? data.total_pages : 1
        );
      })
      .catch(() => {
        if (!isMounted) return;
        setItems([]);
        setTotalItems(0);
        setTotalPages(1);
        setLoadError("Cannot load items. Check backend connection.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [activeTab, page, appliedFilters]);

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
                      onClick={() => {
                        setAppliedFilters(filters);
                        setPage(1);
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-[#f3e5d6] px-8 py-1.5 text-[12px] font-semibold text-black/80 transition hover:bg-[#ead4c0]"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              {/* Item list table */}
              <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="text-[13px] font-semibold text-black">
                  Item List ({totalItems})
                </div>

                <div className="mt-4 max-h-[420px] overflow-y-auto overflow-x-auto">
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
                      {items.map((item) => (
                        <tr
                          key={item.item_id ?? item.sku ?? item.name}
                          className="border-t border-black/5"
                        >
                          <td className="py-2 whitespace-nowrap">
                            {item.sku ?? "-"}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {item.name ?? "-"}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {item.variant_name ?? "-"}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {item.item_type ?? "-"}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {item.current_qty ?? "-"}
                          </td>
                          <td className="py-2">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                                STATUS_STYLES[item.status] ??
                                  "border-black/10 text-black/70",
                              ].join(" ")}
                            >
                              {item.status ?? "-"}
                            </span>
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {item.sell_price ?? "-"}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {item.unit ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isLoading ? (
                  <div className="mt-3 text-[12px] text-black/50">
                    Loading...
                  </div>
                ) : null}
                {loadError ? (
                  <div className="mt-3 text-[12px] text-red-600">{loadError}</div>
                ) : null}
                <div className="mt-4 flex items-center justify-between text-[12px] text-black/60">
                  <div>
                    Page {page} / {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[12px] transition hover:bg-black/15 disabled:opacity-50"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                      (pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          className={[
                            "rounded-full px-3 py-1 text-[12px] transition",
                            pageNumber === page
                              ? "bg-black/10 text-black"
                              : "text-black/60 hover:bg-black/5",
                          ].join(" ")}
                          onClick={() => setPage(pageNumber)}
                        >
                          {pageNumber}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[12px] transition hover:bg-black/15 disabled:opacity-50"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page >= totalPages}
                    >
                      Next
                    </button>
                  </div>
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
