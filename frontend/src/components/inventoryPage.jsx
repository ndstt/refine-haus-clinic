import { useEffect, useMemo, useRef, useState } from "react";

const SIDEBAR_ITEMS = [
  { key: "item-list", label: "Item List" },
  { key: "import-items", label: "Import" },
  { key: "withdraw-items", label: "Withdraw" },
];

const STATUS_STYLES = {
  Ready: "bg-[#e7efe4] text-[#3f6b4c] border-[#cfe0c7]",
  Low: "bg-[#f6e6e3] text-[#8a3b30] border-[#e7c6bf]",
};

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {hint ? <span className="text-[11px] font-medium text-black/35">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function ToggleIcon() {
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
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (kind === "item-list") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" {...common}>
        <path d="M12 2 3 7l9 5 9-5-9-5Z" />
        <path d="M3 7v10l9 5 9-5V7" />
        <path d="M12 12v10" />
      </svg>
    );
  }

  if (kind === "import-items") {
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

function normalizeName(v) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function apiItemType(label) {
  if (label === "Medicine") return "MEDICINE";
  if (label === "Tool") return "MEDICAL_TOOL";
  return label;
}

function uiItemType(apiValue) {
  if (apiValue === "MEDICINE") return "Medicine";
  if (apiValue === "MEDICAL_TOOL") return "Tool";
  return apiValue ?? "Medicine";
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function todayISODate() {
  const d = new Date();
  // Local date -> YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function InventoryPage() {
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

  const [activeTab, setActiveTab] = useState("item-list");
  const [collapsed, setCollapsed] = useState(false);

  // -----------------------------
  // Item list tab
  // -----------------------------
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

  // -----------------------------
  // Import tab (Draft invoice flow)
  // -----------------------------
  const [draftHeader, setDraftHeader] = useState({
    supplierName: "",
    issueDate: todayISODate(),
  });

  const [draftId, setDraftId] = useState(null);
  const [draftNo, setDraftNo] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftConfirming, setDraftConfirming] = useState(false);

  const [draftItems, setDraftItems] = useState([]);
  const [draftItemsLoading, setDraftItemsLoading] = useState(false);
  const [draftItemsError, setDraftItemsError] = useState("");

  // Supplier autocomplete (ใช้ร่วมกับ header)
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const supplierFetchSeq = useRef(0);

  const resolvedSupplierId = useMemo(() => {
    const n = normalizeName(draftHeader.supplierName);
    if (!n) return null;
    const hit = supplierOptions.find((s) => normalizeName(s.name) === n);
    return hit?.supplier_id ?? null;
  }, [draftHeader.supplierName, supplierOptions]);

  const [itemForm, setItemForm] = useState({
    code: "",
    name: "",
    variant: "",
    type: "Medicine",
    qty: "",
    unit: "",
    buyPrice: "",
    expireDate: "",
  });
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [itemError, setItemError] = useState("");
  const [itemLookupLoading, setItemLookupLoading] = useState(false);
  const itemLookupSeq = useRef(0);

  // Import History (Recent + Filter)
  const [importFilters, setImportFilters] = useState({
    code: "",
    name: "",
    variant: "",
    type: "All",
    supplierName: "",
    timeFrom: "",
    timeTo: "",
    timeOrder: "desc",
    qtyMin: "",
    qtyMax: "",
    buyPriceMin: "",
    buyPriceMax: "",
    expireFrom: "",
    expireTo: "",
  });
  const [appliedImportFilters, setAppliedImportFilters] = useState({
    code: "",
    name: "",
    variant: "",
    type: "All",
    supplierName: "",
    timeFrom: "",
    timeTo: "",
    timeOrder: "desc",
    qtyMin: "",
    qtyMax: "",
    buyPriceMin: "",
    buyPriceMax: "",
    expireFrom: "",
    expireTo: "",
  });
  const [recentImports, setRecentImports] = useState([]);
  const [importsLoading, setImportsLoading] = useState(false);
  const [importsError, setImportsError] = useState("");

  // -----------------------------
  // Restore draft (localStorage)
  // -----------------------------
  useEffect(() => {
    if (activeTab !== "import-items") return;
    if (draftId) return;
    try {
      const saved = localStorage.getItem("purchaseImportDraftId");
      if (saved) {
        const id = Number(saved);
        if (Number.isFinite(id) && id > 0) {
          setDraftId(id);
        }
      }
    } catch {
      // ignore
    }
  }, [activeTab, draftId]);

  useEffect(() => {
    try {
      if (draftId) localStorage.setItem("purchaseImportDraftId", String(draftId));
      else localStorage.removeItem("purchaseImportDraftId");
    } catch {
      // ignore
    }
  }, [draftId]);

  // -----------------------------
  // Item list fetch
  // -----------------------------
  useEffect(() => {
    if (activeTab !== "item-list") return;
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
  }, [activeTab, page, appliedFilters, apiBase]);

  // -----------------------------
  // Supplier autocomplete (Import header)
  // -----------------------------
  useEffect(() => {
    if (activeTab !== "import-items") return;
    const q = draftHeader.supplierName;
    const norm = normalizeName(q);
    if (!norm) {
      setSupplierOptions([]);
      setSupplierLoading(false);
      return;
    }

    const t = setTimeout(() => {
      const seq = ++supplierFetchSeq.current;
      setSupplierLoading(true);

      const params = new URLSearchParams({ query: q, limit: "8" });

      fetch(`${apiBase}/resource/supplier?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          return res.json();
        })
        .then((data) => {
          if (seq !== supplierFetchSeq.current) return;
          const list = Array.isArray(data.items)
            ? data.items
            : Array.isArray(data.suppliers)
              ? data.suppliers
              : Array.isArray(data)
                ? data
                : [];
          setSupplierOptions(
            list
              .map((s) => ({
                supplier_id: s.supplier_id ?? s.id,
                name: s.name ?? s.supplier_name ?? s.label ?? "",
              }))
              .filter((s) => s.supplier_id && s.name)
          );
        })
        .catch(() => {
          if (seq !== supplierFetchSeq.current) return;
          setSupplierOptions([]);
        })
        .finally(() => {
          if (seq !== supplierFetchSeq.current) return;
          setSupplierLoading(false);
        });
    }, 220);

    return () => clearTimeout(t);
  }, [activeTab, draftHeader.supplierName, apiBase]);

  // -----------------------------
  // Import history fetch
  // -----------------------------
  useEffect(() => {
    if (activeTab !== "import-items") return;

    let isMounted = true;
    setImportsLoading(true);
    setImportsError("");

    const params = new URLSearchParams({ limit: "10" });
    if (appliedImportFilters.code) params.set("code", appliedImportFilters.code);
    if (appliedImportFilters.name) params.set("name", appliedImportFilters.name);
    if (appliedImportFilters.variant)
      params.set("variant", appliedImportFilters.variant);
    if (appliedImportFilters.type && appliedImportFilters.type !== "All") {
      params.set("item_type", apiItemType(appliedImportFilters.type));
    }
    if (appliedImportFilters.supplierName)
      params.set("supplier_name", appliedImportFilters.supplierName);
    if (appliedImportFilters.timeFrom)
      params.set("time_from", appliedImportFilters.timeFrom);
    if (appliedImportFilters.timeTo)
      params.set("time_to", appliedImportFilters.timeTo);
    if (appliedImportFilters.timeOrder)
      params.set("time_order", appliedImportFilters.timeOrder);
    if (appliedImportFilters.qtyMin) params.set("qty_min", appliedImportFilters.qtyMin);
    if (appliedImportFilters.qtyMax) params.set("qty_max", appliedImportFilters.qtyMax);
    if (appliedImportFilters.buyPriceMin)
      params.set("buy_price_min", appliedImportFilters.buyPriceMin);
    if (appliedImportFilters.buyPriceMax)
      params.set("buy_price_max", appliedImportFilters.buyPriceMax);
    if (appliedImportFilters.expireFrom)
      params.set("expire_from", appliedImportFilters.expireFrom);
    if (appliedImportFilters.expireTo)
      params.set("expire_to", appliedImportFilters.expireTo);

    fetch(`${apiBase}/transaction/import-items?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.imports)
            ? data.imports
            : Array.isArray(data)
              ? data
              : [];
        setRecentImports(list);
      })
      .catch(() => {
        if (!isMounted) return;
        setRecentImports([]);
        setImportsError("Cannot load import list. Check backend connection.");
      })
      .finally(() => {
        if (!isMounted) return;
        setImportsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, appliedImportFilters, apiBase]);

  // -----------------------------
  // Auto-fill item name/variant when item code is typed
  // -----------------------------
  useEffect(() => {
    if (activeTab !== "import-items") return;

    const code = itemForm.code?.trim();
    if (!code) {
      setItemLookupLoading(false);
      return;
    }

    const seq = ++itemLookupSeq.current;
    setItemLookupLoading(true);

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ code, limit: "1" });
      fetch(`${apiBase}/resource/item-catalog?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          return res.json();
        })
        .then((data) => {
          if (seq !== itemLookupSeq.current) return;
          const list = Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];
          if (!list.length) return;
          const item = list[0] ?? {};
          setItemForm((prev) => ({
            ...prev,
            name: item.name ?? prev.name,
            variant: item.variant_name ?? prev.variant,
            type: item.item_type ? uiItemType(item.item_type) : prev.type,
            unit: item.unit ?? prev.unit,
          }));
        })
        .catch(() => {
          if (seq !== itemLookupSeq.current) return;
        })
        .finally(() => {
          if (seq !== itemLookupSeq.current) return;
          setItemLookupLoading(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [activeTab, itemForm.code, apiBase]);

  // -----------------------------
  // Draft helpers
  // -----------------------------
  const draftTotal = useMemo(() => {
    return draftItems.reduce((acc, it) => {
      const qty = Number(it.qty ?? it.quantity ?? 0);
      const price = Number(it.purchase_price_per_unit ?? it.buy_price ?? it.purchasePricePerUnit ?? 0);
      return acc + qty * price;
    }, 0);
  }, [draftItems]);

  async function lookupItemByCode() {
    const code = itemForm.code?.trim();
    if (!code) return;

    try {
      const params = new URLSearchParams({ page: "1", limit: "1", code });
      const res = await fetch(`${apiBase}/resource/item-catalog?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const hit = Array.isArray(data.items) ? data.items[0] : null;
      if (!hit) return;

      setItemForm((s) => ({
        ...s,
        name: s.name || hit.name || "",
        variant: s.variant || hit.variant_name || "",
        type: uiItemType(hit.item_type),
        unit: s.unit || hit.unit || "",
      }));
    } catch {
      // ignore
    }
  }

  async function fetchDraftItems(id) {
    setDraftItemsError("");
    setDraftItemsLoading(true);

    try {
      // พยายามยิงแบบ 1: GET /purchase-invoice/{id}
      const res = await fetch(`${apiBase}/purchase-invoice/${id}`);
      if (res.ok) {
        const data = await safeJson(res);
        const header = data?.header ?? data?.purchase_invoice ?? data;
        const list = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.purchase_invoice_items)
            ? data.purchase_invoice_items
            : Array.isArray(header?.items)
              ? header.items
              : [];

        if (header?.purchase_no && !draftNo) setDraftNo(header.purchase_no);
        if (header?.issue_at) {
          const iso = String(header.issue_at).slice(0, 10);
          if (iso) setDraftHeader((s) => ({ ...s, issueDate: iso }));
        }
        if (header?.supplier_name) setDraftHeader((s) => ({ ...s, supplierName: header.supplier_name }));
        if (header?.supplier?.name)
          setDraftHeader((s) => ({ ...s, supplierName: header.supplier.name }));

        setDraftItems(list);
        return;
      }

      // fallback: GET /purchase-invoice/{id}/items
      const res2 = await fetch(`${apiBase}/purchase-invoice/${id}/items`);
      if (!res2.ok) throw new Error("draft items fetch failed");
      const data2 = await safeJson(res2);
      const list2 = Array.isArray(data2?.items)
        ? data2.items
        : Array.isArray(data2)
          ? data2
          : [];
      setDraftItems(list2);
    } catch {
      setDraftItems([]);
      setDraftItemsError("Cannot load draft items. Check backend endpoints.");
    } finally {
      setDraftItemsLoading(false);
    }
  }

  // ถ้ามี draftId (เช่น restore จาก localStorage) ให้โหลดรายการขึ้นมาทันที
  useEffect(() => {
    if (activeTab !== "import-items") return;
    if (!draftId) return;
    // load header+items
    fetchDraftItems(draftId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, draftId]);

  async function createDraft() {
    setDraftError("");

    const supplierName = (draftHeader.supplierName?.trim() ?? "");

    setDraftSaving(true);
    try {
      const payload = {
        // supplier เป็น optional: ถ้าไม่กรอก ให้ส่ง null ไป
        supplier_id: supplierName ? (resolvedSupplierId ?? null) : null,
        supplier_name: supplierName || null,
        issue_at: draftHeader.issueDate ? `${draftHeader.issueDate}T00:00:00` : null,
      };

      // Endpoint (แก้ path ได้): POST /purchase-invoice/draft
      const res = await fetch(`${apiBase}/purchase-invoice/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      const created = await safeJson(res);
      const id = created?.purchase_invoice_id ?? created?.id ?? created?.purchaseInvoiceId;
      const no = created?.purchase_no ?? created?.purchaseNo ?? "";
      if (!id) throw new Error("Missing purchase_invoice_id from backend response");
      setDraftId(id);
      setDraftNo(no);
      await fetchDraftItems(id);
    } catch (e) {
      setDraftError(
        e?.message || "Create draft failed. Check backend endpoint (/purchase-invoice/draft)."
      );
    } finally {
      setDraftSaving(false);
    }
  }

  async function saveDraftHeader() {
    if (!draftId) return;
    setDraftError("");

    const supplierName = (draftHeader.supplierName?.trim() ?? "");

    setDraftSaving(true);
    try {
      const payload = {
        // supplier เป็น optional: ถ้าไม่กรอก ให้ส่ง null ไป
        supplier_id: supplierName ? (resolvedSupplierId ?? null) : null,
        supplier_name: supplierName || null,
        issue_at: draftHeader.issueDate ? `${draftHeader.issueDate}T00:00:00` : null,
      };

      // Endpoint (แก้ path ได้): PATCH /purchase-invoice/{id}
      const res = await fetch(`${apiBase}/purchase-invoice/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
    } catch (e) {
      setDraftError(e?.message || "Save header failed.");
    } finally {
      setDraftSaving(false);
    }
  }

  async function addItemToDraft() {
    setItemError("");
    if (!draftId) return setItemError("Create draft first.");

    const payload = {
      item_code: itemForm.code?.trim(),
      item_name: itemForm.name?.trim(),
      item_variant: itemForm.variant?.trim(),
      item_type: apiItemType(itemForm.type),
      qty: Number(itemForm.qty),
      unit: itemForm.unit?.trim(),
      purchase_price_per_unit: Number(itemForm.buyPrice),
      expire_date: itemForm.expireDate ? String(itemForm.expireDate) : null,
    };

    if (!payload.item_name) return setItemError("Item Name is required.");
    if (!payload.qty || payload.qty <= 0)
      return setItemError("Quantity must be greater than 0.");
    if (!payload.unit) return setItemError("Unit is required.");
    if (!payload.purchase_price_per_unit || payload.purchase_price_per_unit <= 0)
      return setItemError("Buy Price / piece must be greater than 0.");

    setItemSubmitting(true);
    try {
      // Endpoint (แก้ path ได้): POST /purchase-invoice/{id}/items
      const res = await fetch(`${apiBase}/purchase-invoice/${draftId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      const created = await safeJson(res);
      // ถ้า backend ส่งคืนเป็นรายการเดียว
      if (created) {
        setDraftItems((prev) => [created, ...prev]);
      } else {
        await fetchDraftItems(draftId);
      }

      setItemForm((s) => ({
        ...s,
        code: "",
        name: "",
        variant: "",
        type: "Medicine",
        qty: "",
        unit: "",
        buyPrice: "",
        expireDate: "",
      }));
    } catch (e) {
      setItemError(e?.message || "Add item failed.");
    } finally {
      setItemSubmitting(false);
    }
  }

  async function removeDraftItem(row) {
    if (!draftId) return;
    const rowId =
      row.purchase_invoice_item_id ??
      row.purchaseInvoiceItemId ??
      row.id ??
      null;
    // ถ้า backend ไม่มี id ต่อแถวจริง ๆ จะลบยาก — แนะนำให้มี purchase_invoice_item_id
    if (!rowId) {
      setDraftItemsError(
        "Cannot remove this row because purchase_invoice_item_id is missing."
      );
      return;
    }

    try {
      const res = await fetch(
        `${apiBase}/purchase-invoice/${draftId}/items/${rowId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }
      setDraftItems((prev) => prev.filter((x) => (x.id ?? x.purchase_invoice_item_id ?? x.purchaseInvoiceItemId) !== rowId));
    } catch (e) {
      setDraftItemsError(e?.message || "Remove failed.");
    }
  }

  async function confirmDraft() {
    if (!draftId) return;
    setDraftError("");
    setDraftConfirming(true);
    try {
      // Endpoint (แก้ path ได้): POST /purchase-invoice/{id}/confirm
      const res = await fetch(`${apiBase}/purchase-invoice/${draftId}/confirm`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message ?? `Request failed (${res.status})`);
      }

      // รีเซ็ต draft
      setDraftId(null);
      setDraftNo("");
      setDraftItems([]);
      setDraftHeader({
        issueDate: todayISODate(),
        supplierName: "",
      });
      setItemForm({
        code: "",
        name: "",
        variant: "",
        type: "Medicine",
        qty: "",
        unit: "",
        buyPrice: "",
        expireDate: "",
      });

      // refresh history
      setAppliedImportFilters((x) => ({ ...x }));
    } catch (e) {
      setDraftError(e?.message || "Confirm failed.");
    } finally {
      setDraftConfirming(false);
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <section className="bg-[#f6eadb] px-6 py-10">
      <div className="mx-auto flex w-full max-w-[1200px]">
        {/* Sidebar */}
        <aside
          className={[
            "border-r border-black/10 bg-[#f6eadb] transition-[width] duration-200",
            collapsed ? "w-[72px]" : "w-[240px]",
          ].join(" ")}
        >
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

          {collapsed ? (
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
                      <span className="text-[18px] text-black/80">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <div className="flex-1 px-8 py-6">
          <div>
            <h1 className="text-[24px] font-semibold text-black">
              {getTitle(activeTab)}
            </h1>
            <p className="mt-1 text-[13px] text-black/60">
              Checking items information and amount
            </p>
          </div>

          {/* --------------------- */}
          {/* ITEM LIST TAB */}
          {/* --------------------- */}
          {activeTab === "item-list" ? (
            <>
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
                          <td className="py-2 whitespace-nowrap">{item.sku ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{item.name ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">
                            {item.variant_name ?? "-"}
                          </td>
                          <td className="py-2 whitespace-nowrap">{item.item_type ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{item.current_qty ?? "-"}</td>
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
                          <td className="py-2 whitespace-nowrap">{item.sell_price ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{item.unit ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isLoading ? (
                  <div className="mt-3 text-[12px] text-black/50">Loading...</div>
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
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* --------------------- */}
          {/* IMPORT TAB (Draft invoice flow) */}
          {/* --------------------- */}
          {activeTab === "import-items" ? (
            <>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                {/* Draft header */}
                <div className="rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold text-black">
                        Import Draft
                      </div>
                      <p className="mt-1 text-[12px] text-black/50">
                        สร้าง Draft ใบรับเข้า 1 ใบ แล้วค่อยเพิ่มรายการทีละบรรทัด
                      </p>
                    </div>
                    {draftId ? (
                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-black/40">
                          Draft No.
                        </div>
                        <div className="text-[12px] font-semibold text-black/70">
                          {draftNo || `#${draftId}`}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Supplier Name" hint={resolvedSupplierId ? `matched id: ${resolvedSupplierId}` : "optional • quick create"}>
                      <div className="relative">
                        <input
                          className="w-full rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                          value={draftHeader.supplierName}
                          onChange={(e) => {
                            setDraftHeader((s) => ({
                              ...s,
                              supplierName: e.target.value,
                            }));
                            setSupplierOpen(true);
                          }}
                          onFocus={() => setSupplierOpen(true)}
                          onBlur={() => setTimeout(() => setSupplierOpen(false), 120)}
                          placeholder="ไม่บังคับ — พิมพ์ชื่อ supplier ถ้ารู้ (เลือกจาก list หรือให้ระบบสร้างให้)"
                        />

                        {supplierOpen ? (
                          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow">
                            <div className="max-h-[180px] overflow-y-auto">
                              {!normalizeName(draftHeader.supplierName) ? (
                                <div className="px-3 py-2 text-[12px] text-black/50">
                                  ปล่อยว่างได้ ถ้ายังไม่มีข้อมูล supplier (ใส่ทีหลังได้)
                                </div>
                              ) : supplierLoading ? (
                                <div className="px-3 py-2 text-[12px] text-black/50">
                                  Loading...
                                </div>
                              ) : supplierOptions.length ? (
                                supplierOptions.map((s) => (
                                  <button
                                    key={s.supplier_id}
                                    type="button"
                                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-black/70 hover:bg-black/5"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setDraftHeader((v) => ({ ...v, supplierName: s.name }));
                                      setSupplierOpen(false);
                                    }}
                                  >
                                    <span>{s.name}</span>
                                    <span className="text-[10px] text-black/35">existing</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-[12px] text-black/50">
                                  ไม่เจอในระบบ — กด Create Draft ได้เลย ระบบจะสร้าง supplier ใหม่ให้ (หรือปล่อยว่างก็ได้)
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </Field>

                    <Field label="Issue / Receive Date">
                      <input
                        type="date"
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={draftHeader.issueDate}
                        onChange={(e) =>
                          setDraftHeader((s) => ({ ...s, issueDate: e.target.value }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!draftId ? (
                      <button
                        type="button"
                        onClick={createDraft}
                        disabled={draftSaving}
                        className="inline-flex items-center justify-center rounded-full bg-[#f3e5d6] px-8 py-1.5 text-[12px] font-semibold text-black/80 transition hover:bg-[#ead4c0] disabled:opacity-60"
                      >
                        {draftSaving ? "Creating..." : "Create Draft"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={saveDraftHeader}
                          disabled={draftSaving}
                          className="inline-flex items-center justify-center rounded-full border border-black/10 bg-black/5 px-6 py-1.5 text-[12px] font-semibold text-black/70 transition hover:bg-black/10 disabled:opacity-60"
                        >
                          {draftSaving ? "Saving..." : "Save Header"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftId(null);
                            setDraftNo("");
                            setDraftItems([]);
                            setDraftError("");
                            setDraftItemsError("");
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-1.5 text-[12px] font-semibold text-black/70 transition hover:bg-black/5"
                        >
                          Close Draft
                        </button>
                        <button
                          type="button"
                          onClick={confirmDraft}
                          disabled={draftConfirming || draftItems.length === 0}
                          className="ml-auto inline-flex items-center justify-center rounded-full bg-black px-8 py-1.5 text-[12px] font-semibold text-white/90 transition hover:bg-black/80 disabled:opacity-50"
                          title={draftItems.length === 0 ? "Add at least 1 item" : ""}
                        >
                          {draftConfirming ? "Confirming..." : "Confirm Import"}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[12px] text-black/50">
                    <span>
                      Total: <span className="font-semibold text-black/70">{draftTotal.toFixed(2)}</span>
                    </span>
                    {draftId ? (
                      <span>
                        Items: <span className="font-semibold text-black/70">{draftItems.length}</span>
                      </span>
                    ) : null}
                  </div>

                  {draftError ? (
                    <div className="mt-3 text-[12px] text-red-600">{draftError}</div>
                  ) : null}
                </div>

                {/* Add item */}
                <div className="rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-sm">
                  <div className="text-[13px] font-semibold text-black">Add Item</div>
                  <p className="mt-1 text-[12px] text-black/50">
                    เพิ่มรายการเข้า Draft (เพิ่มได้ทีละแถว)
                  </p>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <Field label="Item Code">
                      <input
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={itemForm.code}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, code: e.target.value }))
                        }
                        onBlur={lookupItemByCode}
                        placeholder="e.g. MED-NABU-100"
                      />
                    </Field>
                    <Field label="Item Name">
                      <input
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={itemForm.name}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, name: e.target.value }))
                        }
                        placeholder="e.g. Nabuto"
                      />
                    </Field>

                    <Field label="Item Variant">
                      <input
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={itemForm.variant}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, variant: e.target.value }))
                        }
                        placeholder="e.g. 100 u / 1cc"
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px] text-black/70"
                        value={itemForm.type}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, type: e.target.value }))
                        }
                      >
                        <option>Medicine</option>
                        <option>Tool</option>
                      </select>
                    </Field>

                    <Field label="Quantity">
                      <input
                        type="number"
                        min="0"
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={itemForm.qty}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, qty: e.target.value }))
                        }
                        placeholder="e.g. 2"
                      />
                    </Field>
                    <Field label="Unit">
                      <input
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={itemForm.unit}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, unit: e.target.value }))
                        }
                        placeholder="e.g. Piece"
                      />
                    </Field>

                    <Field label="Buy Price / piece">
                      <input
                        type="number"
                        min="0"
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={itemForm.buyPrice}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, buyPrice: e.target.value }))
                        }
                        placeholder="e.g. 45"
                      />
                    </Field>
                    <Field label="Expire Date">
                      <input
                        type="date"
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                        value={itemForm.expireDate}
                        onChange={(e) =>
                          setItemForm((s) => ({ ...s, expireDate: e.target.value }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={addItemToDraft}
                      disabled={itemSubmitting || !draftId}
                      className="ml-auto inline-flex items-center justify-center rounded-full bg-[#f3e5d6] px-10 py-1.5 text-[12px] font-semibold text-black/80 transition hover:bg-[#ead4c0] disabled:opacity-60"
                      title={!draftId ? "Create Draft first" : ""}
                    >
                      {itemSubmitting ? "Adding..." : "Add to Draft"}
                    </button>
                  </div>

                  {itemError ? (
                    <div className="mt-3 text-[12px] text-red-600">{itemError}</div>
                  ) : null}
                </div>
              </div>

              {/* Draft items table */}
              <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-black">Draft Items</div>
                    <p className="mt-1 text-[12px] text-black/50">
                      รายการใน Draft ปัจจุบัน
                    </p>
                  </div>
                  {draftId ? (
                    <button
                      type="button"
                      onClick={() => fetchDraftItems(draftId)}
                      className="rounded-full border border-black/10 bg-black/5 px-5 py-1.5 text-[12px] font-semibold text-black/70 transition hover:bg-black/10"
                      disabled={draftItemsLoading}
                    >
                      {draftItemsLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  ) : null}
                </div>

                {!draftId ? (
                  <div className="mt-4 text-[12px] text-black/50">
                    ยังไม่มี Draft — สร้าง Draft ก่อน แล้วค่อยเพิ่มรายการ
                  </div>
                ) : (
                  <>
                    <div className="mt-4 max-h-[320px] overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-[12px] text-black/80">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-[0.12em] text-black/50">
                            <th className="pb-3 font-semibold">Code</th>
                            <th className="pb-3 font-semibold">Name</th>
                            <th className="pb-3 font-semibold">Variant</th>
                            <th className="pb-3 font-semibold">Qty</th>
                            <th className="pb-3 font-semibold">Buy Price</th>
                            <th className="pb-3 font-semibold">Expire</th>
                            <th className="pb-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftItems.map((row, idx) => (
                            <tr key={row.purchase_invoice_item_id ?? row.id ?? idx} className="border-t border-black/5">
                              <td className="py-2 whitespace-nowrap">{row.item_code ?? row.sku ?? row.code ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap">{row.item_name ?? row.name ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap">{row.item_variant ?? row.variant_name ?? row.variant ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap">{row.qty ?? row.quantity ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap">{row.purchase_price_per_unit ?? row.buy_price ?? row.purchasePricePerUnit ?? "-"}</td>
                              <td className="py-2 whitespace-nowrap">{formatDate(row.expire_date ?? row.expireDate)}</td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  onClick={() => removeDraftItem(row)}
                                  className="rounded-full border border-black/10 bg-white px-4 py-1 text-[12px] font-semibold text-black/60 transition hover:bg-black/5"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {draftItemsLoading ? (
                      <div className="mt-3 text-[12px] text-black/50">Loading...</div>
                    ) : null}
                    {draftItemsError ? (
                      <div className="mt-3 text-[12px] text-red-600">{draftItemsError}</div>
                    ) : null}
                  </>
                )}
              </div>

              {/* Import history */}
              <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
                <div className="text-[13px] font-semibold text-black">Import History</div>
                <p className="mt-1 text-[12px] text-black/50">
                  รายการรับเข้าล่าสุด (ยืนยันแล้ว) + ค้นหาด้วย filter
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-5">
                  <Field label="Item Code">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.code}
                      onChange={(e) =>
                        setImportFilters((s) => ({ ...s, code: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Item Name">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.name}
                      onChange={(e) =>
                        setImportFilters((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Item Variant">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.variant}
                      onChange={(e) =>
                        setImportFilters((s) => ({ ...s, variant: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Item Type">
                    <select
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px] text-black/70"
                      value={importFilters.type}
                      onChange={(e) =>
                        setImportFilters((s) => ({ ...s, type: e.target.value }))
                      }
                    >
                      <option>All</option>
                      <option>Medicine</option>
                      <option>Tool</option>
                    </select>
                  </Field>
                  <Field label="Supplier">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.supplierName}
                      onChange={(e) =>
                        setImportFilters((s) => ({
                          ...s,
                          supplierName: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <Field label="Qty Min">
                    <input
                      type="number"
                      min="0"
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.qtyMin}
                      onChange={(e) =>
                        setImportFilters((s) => ({ ...s, qtyMin: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Qty Max">
                    <input
                      type="number"
                      min="0"
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.qtyMax}
                      onChange={(e) =>
                        setImportFilters((s) => ({ ...s, qtyMax: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Buy Price Min">
                    <input
                      type="number"
                      min="0"
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.buyPriceMin}
                      onChange={(e) =>
                        setImportFilters((s) => ({
                          ...s,
                          buyPriceMin: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Buy Price Max">
                    <input
                      type="number"
                      min="0"
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.buyPriceMax}
                      onChange={(e) =>
                        setImportFilters((s) => ({
                          ...s,
                          buyPriceMax: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <Field label="Time From" hint="ISO / date-time">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.timeFrom}
                      onChange={(e) =>
                        setImportFilters((s) => ({
                          ...s,
                          timeFrom: e.target.value,
                        }))
                      }
                      placeholder="2026-01-01T00:00:00"
                    />
                  </Field>
                  <Field label="Time To" hint="ISO / date-time">
                    <input
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.timeTo}
                      onChange={(e) =>
                        setImportFilters((s) => ({ ...s, timeTo: e.target.value }))
                      }
                      placeholder="2026-01-31T23:59:59"
                    />
                  </Field>
                  <Field label="Time Order">
                    <select
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.timeOrder}
                      onChange={(e) =>
                        setImportFilters((s) => ({
                          ...s,
                          timeOrder: e.target.value,
                        }))
                      }
                    >
                      <option value="desc">Newest → Oldest</option>
                      <option value="asc">Oldest → Newest</option>
                    </select>
                  </Field>
                  <Field label="Expire From">
                    <input
                      type="date"
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.expireFrom}
                      onChange={(e) =>
                        setImportFilters((s) => ({
                          ...s,
                          expireFrom: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Expire To">
                    <input
                      type="date"
                      className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1.5 text-[12px]"
                      value={importFilters.expireTo}
                      onChange={(e) =>
                        setImportFilters((s) => ({
                          ...s,
                          expireTo: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 flex items-center">
                  <button
                    type="button"
                    onClick={() => setAppliedImportFilters(importFilters)}
                    className="ml-auto inline-flex items-center justify-center rounded-full bg-[#f3e5d6] px-8 py-1.5 text-[12px] font-semibold text-black/80 transition hover:bg-[#ead4c0]"
                  >
                    Search
                  </button>
                </div>

                <div className="mt-4 max-h-[360px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-[12px] text-black/80">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.12em] text-black/50">
                        <th className="pb-3 font-semibold">Time</th>
                        <th className="pb-3 font-semibold">Supplier</th>
                        <th className="pb-3 font-semibold">Code</th>
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Variant</th>
                        <th className="pb-3 font-semibold">Qty</th>
                        <th className="pb-3 font-semibold">Buy Price</th>
                        <th className="pb-3 font-semibold">Expire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentImports.map((row, idx) => (
                        <tr key={row.id ?? row.created_at ?? idx} className="border-t border-black/5">
                          <td className="py-2 whitespace-nowrap">{formatDateTime(row.time ?? row.created_at ?? row.createdAt)}</td>
                          <td className="py-2 whitespace-nowrap">{row.supplier_name ?? row.supplierName ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{row.item_code ?? row.sku ?? row.code ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{row.item_name ?? row.name ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{row.item_variant ?? row.variant_name ?? row.variant ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{row.qty ?? row.quantity ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{row.purchase_price_per_unit ?? row.buy_price ?? row.purchasePricePerUnit ?? "-"}</td>
                          <td className="py-2 whitespace-nowrap">{formatDate(row.expire_date ?? row.expireDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importsLoading ? (
                  <div className="mt-3 text-[12px] text-black/50">Loading...</div>
                ) : null}
                {importsError ? (
                  <div className="mt-3 text-[12px] text-red-600">{importsError}</div>
                ) : null}
              </div>
            </>
          ) : null}

          {/* --------------------- */}
          {/* WITHDRAW TAB */}
          {/* --------------------- */}
          {activeTab === "withdraw-items" ? (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
              <div className="text-[14px] font-semibold text-black">Withdraw Items</div>
              <p className="mt-2 text-[12px] text-black/50">
                หน้านี้ยังเป็น placeholder — ถ้าจะทำ flow ถอนของแบบ draft เหมือน Import ได้เหมือนกัน
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
