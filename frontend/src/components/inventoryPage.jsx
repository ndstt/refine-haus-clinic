import { useMemo, useState } from "react";

const SIDEBAR_ITEMS = [
  { key: "item-list", label: "ITEM LIST" },
  { key: "import-items", label: "IMPORT ITEMS" },
  { key: "withdraw-items", label: "WITHDRAW ITEMS" },
];

const INVENTORY_ITEMS = [
  {
    name: "Nabuto",
    type: "Medicine",
    quantity: "420 u",
    status: "Ready",
    price: 45,
    unit: "u",
  },
  {
    name: "Xeomin",
    type: "Medicine",
    quantity: "180 u",
    status: "Low",
    price: 55,
    unit: "u",
  },
  {
    name: "Derma Glow",
    type: "Medicine",
    quantity: "59 cc",
    status: "Ready",
    price: 70,
    unit: "cc",
  },
  {
    name: "Neuramis",
    type: "Medicine",
    quantity: "320 u",
    status: "Ready",
    price: 48,
    unit: "u",
  },
  {
    name: "Rejuran",
    type: "Medicine",
    quantity: "28 cc",
    status: "Low",
    price: 32,
    unit: "cc",
  },
  {
    name: "Laser Tip",
    type: "Tool",
    quantity: "60 pieces",
    status: "Ready",
    price: 40,
    unit: "piece",
  },
  {
    name: "Syringe 1cc",
    type: "Tool",
    quantity: "14 pieces",
    status: "Ready",
    price: 1200,
    unit: "piece",
  },
  {
    name: "Needle 30G",
    type: "Tool",
    quantity: "48 pieces",
    status: "Ready",
    price: 12,
    unit: "piece",
  },
  {
    name: "Cotton Ball",
    type: "Tool",
    quantity: "500 pieces",
    status: "Ready",
    price: 8,
    unit: "piece",
  },
  {
    name: "Gauze",
    type: "Tool",
    quantity: "10 pieces",
    status: "Low",
    price: 120,
    unit: "piece",
  },
  {
    name: "Alcohol Pad",
    type: "Tool",
    quantity: "20 pieces",
    status: "Low",
    price: 95,
    unit: "piece",
  },
  {
    name: "Tissue",
    type: "Tool",
    quantity: "1 pieces",
    status: "Low",
    price: 180,
    unit: "piece",
  },
];

const STATUS_STYLES = {
  Ready: "bg-[#e7efe4] text-[#3f6b4c] border-[#cfe0c7]",
  Low: "bg-[#f6e6e3] text-[#8a3b30] border-[#e7c6bf]",
};

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("item-list");

  // search / filter (UI-only for now)
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // import form (UI-only)
  const [importForm, setImportForm] = useState({
    name: "",
    invoice: "",
    qty: "",
    unit: "u",
    price: "",
    type: "Medicine",
  });

  // withdraw form (UI-only)
  const [withdrawForm, setWithdrawForm] = useState({
    name: "",
    qty: "",
  });

  const filteredItems = useMemo(() => {
    return INVENTORY_ITEMS.filter((item) => {
      const okQ = q.trim()
        ? item.name.toLowerCase().includes(q.trim().toLowerCase())
        : true;
      const okType = typeFilter === "All" ? true : item.type === typeFilter;
      const okStatus = statusFilter === "All" ? true : item.status === statusFilter;
      return okQ && okType && okStatus;
    });
  }, [q, typeFilter, statusFilter]);

  return (
    <section className="px-6 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-[1200px] bg-[#f6eadb]">
        <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-stretch">
        <aside className="w-full bg-[#a39373] px-6 py-8 lg:w-[230px] lg:py-10">
          <div className="font-luxury text-[28px] uppercase tracking-[0.2em] text-black">
            Inventory
          </div>

          <div className="mt-8 space-y-4">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] uppercase tracking-[0.24em]",
                    isActive
                      ? "bg-[#d7ccb6] text-black"
                      : "bg-[#cbbfa8] text-black/90 hover:bg-[#d7ccb6]",
                  ].join(" ")}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-black/30">
                    <span className="block h-3.5 w-3.5 rounded-sm border border-black/50" />
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1">
          <div>
            <h1 className="text-[26px] font-semibold text-black">
              {activeTab === "item-list"
                ? "Item List"
                : activeTab === "import-items"
                  ? "Import Items"
                  : "Withdraw Items"}
            </h1>
            <p className="mt-1 text-[13px] text-black/60">
              {activeTab === "item-list"
                ? "Checking items information and amount"
                : activeTab === "import-items"
                  ? "Import items information and amount"
                  : "Withdraw items from using or edit"}
            </p>
          </div>

          {/* Search + Filter (shown on Item List only, matching the PDF layout) */}
          {activeTab === "item-list" && (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-sm">
            <div className="text-[14px] font-semibold text-black">
              Search and Filter
            </div>
            <p className="mt-1 text-[12px] text-black/50">
              Search and Filter by condition you want
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                Item Name
                <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2">
                  <svg
                    className="h-4 w-4 text-black/40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  <input
                    className="w-full bg-transparent text-[12px] text-black placeholder:text-black/40 focus:outline-none"
                    placeholder="Search for specific item"
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                Item Type
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px] text-black/70 focus:outline-none"
                >
                  <option>All</option>
                  <option>Medicine</option>
                  <option>Tool</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px] text-black/70 focus:outline-none"
                >
                  <option>All</option>
                  <option>Ready</option>
                  <option>Low</option>
                </select>
              </label>
            </div>
            </div>
          )}

          {/* ITEM LIST */}
          {activeTab === "item-list" && (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[14px] font-semibold text-black">
                Item List ({filteredItems.length})
              </div>

              <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[13px] text-black/80">
                <thead>
                  <tr className="text-[12px] uppercase tracking-[0.12em] text-black/50">
                    <th className="pb-3 font-semibold">Name</th>
                    <th className="pb-3 font-semibold">Type</th>
                    <th className="pb-3 font-semibold">Quantity</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Buy Price / Unit</th>
                    <th className="pb-3 font-semibold">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.name} className="border-t border-black/5">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2">{item.type}</td>
                      <td className="py-2">{item.quantity}</td>
                      <td className="py-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                            STATUS_STYLES[item.status] ??
                              "border-black/10 text-black/70",
                          ].join(" ")}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2">{item.price}</td>
                      <td className="py-2">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}

          {/* IMPORT ITEMS */}
          {activeTab === "import-items" && (
            <div className="mt-6 grid gap-6">
              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Item Name
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={importForm.name}
                      onChange={(e) =>
                        setImportForm((s) => ({ ...s, name: e.target.value }))
                      }
                      placeholder="Nabuto"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Invoice Number
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={importForm.invoice}
                      onChange={(e) =>
                        setImportForm((s) => ({ ...s, invoice: e.target.value }))
                      }
                      placeholder="AB484556555655"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Quantity
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={importForm.qty}
                      onChange={(e) =>
                        setImportForm((s) => ({ ...s, qty: e.target.value }))
                      }
                      placeholder="10"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Unit
                    <select
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={importForm.unit}
                      onChange={(e) =>
                        setImportForm((s) => ({ ...s, unit: e.target.value }))
                      }
                    >
                      <option>u</option>
                      <option>cc</option>
                      <option>piece</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Price / Unit
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={importForm.price}
                      onChange={(e) =>
                        setImportForm((s) => ({ ...s, price: e.target.value }))
                      }
                      placeholder="45"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Type
                    <select
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={importForm.type}
                      onChange={(e) =>
                        setImportForm((s) => ({ ...s, type: e.target.value }))
                      }
                    >
                      <option>Medicine</option>
                      <option>Tool</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg bg-[#a39373] px-6 py-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-black"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setImportForm({
                        name: "",
                        invoice: "",
                        qty: "",
                        unit: "u",
                        price: "",
                        type: "Medicine",
                      })
                    }
                    className="inline-flex items-center justify-center rounded-lg border border-black/20 bg-white px-6 py-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-black"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="text-[14px] font-semibold text-black">Recently Added</div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-[13px] text-black/80">
                    <thead>
                      <tr className="text-[12px] uppercase tracking-[0.12em] text-black/50">
                        <th className="pb-3 font-semibold">Time</th>
                        <th className="pb-3 font-semibold">Invoice Number</th>
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          time: "15/12/2568 09:00:00",
                          invoice: "AB484556555655",
                          name: "Nabuto",
                          type: "Medicine",
                          qty: "10 u",
                        },
                        {
                          time: "15/12/2568 09:12:52",
                          invoice: "FG54884484585",
                          name: "Xeomin",
                          type: "Medicine",
                          qty: "180 u",
                        },
                      ].map((row) => (
                        <tr key={row.invoice} className="border-t border-black/5">
                          <td className="py-2 whitespace-nowrap">{row.time}</td>
                          <td className="py-2 whitespace-nowrap">{row.invoice}</td>
                          <td className="py-2">{row.name}</td>
                          <td className="py-2">{row.type}</td>
                          <td className="py-2 whitespace-nowrap">{row.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* WITHDRAW ITEMS */}
          {activeTab === "withdraw-items" && (
            <div className="mt-6 grid gap-6">
              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Item Name
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={withdrawForm.name}
                      onChange={(e) =>
                        setWithdrawForm((s) => ({ ...s, name: e.target.value }))
                      }
                      placeholder="Nabuto"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
                    Quantity
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[12px]"
                      value={withdrawForm.qty}
                      onChange={(e) =>
                        setWithdrawForm((s) => ({ ...s, qty: e.target.value }))
                      }
                      placeholder="1"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg bg-[#a39373] px-6 py-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-black"
                  >
                    Withdraw
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawForm({ name: "", qty: "" })}
                    className="inline-flex items-center justify-center rounded-lg border border-black/20 bg-white px-6 py-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-black"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="text-[14px] font-semibold text-black">Recently withdraw</div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-[13px] text-black/80">
                    <thead>
                      <tr className="text-[12px] uppercase tracking-[0.12em] text-black/50">
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Quantity</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Buy Price / Unit</th>
                        <th className="pb-3 font-semibold">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {INVENTORY_ITEMS.slice(0, 2).map((item) => (
                        <tr key={item.name} className="border-t border-black/5">
                          <td className="py-2">{item.name}</td>
                          <td className="py-2">{item.type}</td>
                          <td className="py-2">{item.quantity}</td>
                          <td className="py-2">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                                STATUS_STYLES[item.status] ??
                                  "border-black/10 text-black/70",
                              ].join(" ")}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2">{item.price}</td>
                          <td className="py-2">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}
