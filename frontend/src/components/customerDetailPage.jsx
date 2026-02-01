import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";

  const [customer, setCustomer] = useState(null);
  const [treatments, setTreatments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  const imageBase = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/storage/v1/object/public/treatment/`;
  }, [supabaseUrl]);

  useEffect(() => {
    if (!customerId) return;
    let isMounted = true;
    setIsLoading(true);
    setLoadError("");
    setSelectedYear("");
    setSelectedMonth("");

    fetch(`${apiBase}/resource/customers/${customerId}/treatments`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setCustomer(data.customer ?? null);
        setTreatments(Array.isArray(data.treatments) ? data.treatments : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setCustomer(null);
        setTreatments([]);
        setLoadError("Cannot load customer detail. Check backend connection.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiBase, customerId]);

  const monthGroups = useMemo(() => {
    const groups = new Map();
    treatments.forEach((row) => {
      const dateValue = row.session_date ? new Date(row.session_date) : null;
      if (!dateValue || Number.isNaN(dateValue.getTime())) {
        return;
      }
      const key = `${dateValue.getFullYear()}-${String(
        dateValue.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!groups.has(key)) {
        groups.set(key, { key, date: dateValue, items: [] });
      }
      groups.get(key).items.push(row);
    });

    const sorted = Array.from(groups.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    sorted.forEach((group) => {
      group.items.sort((a, b) => {
        const aTime = a.session_date ? new Date(a.session_date).getTime() : 0;
        const bTime = b.session_date ? new Date(b.session_date).getTime() : 0;
        return aTime - bTime;
      });
    });

    return sorted;
  }, [treatments]);

  const yearOptions = useMemo(() => {
    const years = new Set(monthGroups.map((group) => group.date.getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [monthGroups]);

  const monthOptions = useMemo(() => {
    if (!selectedYear) return [];
    const months = monthGroups
      .filter((group) => group.date.getFullYear() === Number(selectedYear))
      .map((group) => group.date.getMonth());
    return Array.from(new Set(months)).sort((a, b) => b - a);
  }, [monthGroups, selectedYear]);

  useEffect(() => {
    if (!monthGroups.length) return;
    const first = monthGroups[0];
    const year = String(first.date.getFullYear());
    const month = String(first.date.getMonth());
    setSelectedYear(year);
    setSelectedMonth(month);
  }, [monthGroups]);

  const activeGroup =
    monthGroups.find(
      (group) =>
        String(group.date.getFullYear()) === selectedYear &&
        String(group.date.getMonth()) === selectedMonth
    ) ?? null;

  return (
    <section className="bg-[#f6eadb] px-6 py-10">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="mb-4">
          <Link
            to="/customer"
            className="text-[12px] font-semibold text-black/60 hover:text-black"
          >
            Back to Customer List
          </Link>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
          <div className="text-[18px] font-semibold text-black">Customer Detail</div>
          <p className="mt-1 text-[12px] text-black/50">
            Treatments history for selected customer
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="text-[12px] text-black/60">Code</div>
            <div className="text-[12px] text-black">{customer?.customer_code || "-"}</div>

            <div className="text-[12px] text-black/60">Full Name</div>
            <div className="text-[12px] text-black">{customer?.full_name || "-"}</div>

            <div className="text-[12px] text-black/60">Nickname</div>
            <div className="text-[12px] text-black">{customer?.nickname || "-"}</div>

            <div className="text-[12px] text-black/60">Phone</div>
            <div className="text-[12px] text-black">{customer?.phone || "-"}</div>

            <div className="text-[12px] text-black/60">Date of Birth</div>
            <div className="text-[12px] text-black">{customer?.date_of_birth || "-"}</div>

            <div className="text-[12px] text-black/60">Gender</div>
            <div className="text-[12px] text-black">{customer?.gender || "-"}</div>

            <div className="text-[12px] text-black/60">Wallet</div>
            <div className="text-[12px] text-black">
              {customer?.member_wallet_remain ?? "-"}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[14px] font-semibold text-black">
                Treatment History
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <label className="text-black/60">Month</label>
              <select
                className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-black/70"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={!monthGroups.length}
              >
                {monthOptions.map((month) => (
                  <option key={month} value={String(month)}>
                    {new Date(2000, month, 1).toLocaleDateString("en-US", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
              <label className="text-black/60">Year</label>
              <select
                className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-black/70"
                value={selectedYear}
                onChange={(e) => {
                  const nextYear = e.target.value;
                  setSelectedYear(nextYear);
                  const nextMonths = monthGroups
                    .filter(
                      (group) =>
                        String(group.date.getFullYear()) === nextYear
                    )
                    .map((group) => group.date.getMonth());
                  if (nextMonths.length) {
                    const newestMonth = Math.max(...nextMonths);
                    setSelectedMonth(String(newestMonth));
                  } else {
                    setSelectedMonth("");
                  }
                }}
                disabled={!monthGroups.length}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 max-h-[420px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-[12px] text-black/80">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-black/50">
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Treatment</th>
                  <th className="pb-3 font-semibold">Image</th>
                  <th className="pb-3 font-semibold">Note</th>
                  <th className="pb-3 font-semibold">Next</th>
                </tr>
              </thead>
              <tbody>
                {(activeGroup?.items ?? []).map((row, idx) => (
                  <tr key={`${row.treatment_id}-${idx}`} className="border-t border-black/5">
                    <td className="py-2 whitespace-nowrap">
                      {row.session_date || "-"}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {row.treatment_name || "-"}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {imageBase && row.image_obj_key ? (
                        <img
                          src={`${imageBase}${row.image_obj_key}`}
                          alt={row.treatment_name || "treatment"}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        row.image_obj_key || "-"
                      )}
                    </td>
                    <td className="py-2">{row.note || "-"}</td>
                    <td className="py-2 whitespace-nowrap">
                      {row.next_appointment_date || "-"}
                    </td>
                  </tr>
                ))}
                {!treatments.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 text-center text-[12px] text-black/40"
                    >
                      No treatment history
                    </td>
                  </tr>
                ) : null}
                {treatments.length && !activeGroup ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 text-center text-[12px] text-black/40"
                    >
                      No treatments for this month
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {isLoading ? (
            <div className="mt-3 text-[12px] text-black/50">Loading...</div>
          ) : null}
          {loadError ? (
            <div className="mt-3 text-[12px] text-red-600">{loadError}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
