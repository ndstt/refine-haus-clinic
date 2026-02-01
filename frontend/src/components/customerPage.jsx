import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function CustomerPage() {
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

  const [form, setForm] = useState({
    fullName: "",
    nickname: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function loadCustomers() {
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${apiBase}/resource/customers`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setCustomers(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setCustomers([]);
      setLoadError("Cannot load customers. Check backend connection.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const name = form.fullName.trim();
    if (!name) {
      setSaveError("Please enter a name.");
      return;
    }
    setIsSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${apiBase}/resource/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          nickname: form.nickname || null,
          phone: form.phone || null,
          date_of_birth: form.dateOfBirth || null,
          gender: form.gender || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Request failed (${res.status})`);
      }
      setForm({
        fullName: "",
        nickname: "",
        phone: "",
        dateOfBirth: "",
        gender: "",
      });
      await loadCustomers();
    } catch (err) {
      setSaveError(err?.message || "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="bg-[#f6eadb] px-6 py-10">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
          <div className="text-[18px] font-semibold text-black">Customer</div>
          <p className="mt-1 text-[12px] text-black/50">
            Add customer info and see the list ordered
          </p>

          <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
              Full Name
              <input
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.fullName}
                onChange={(e) =>
                  setForm((s) => ({ ...s, fullName: e.target.value }))
                }
                placeholder="Full name"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
              Nickname
              <input
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.nickname}
                onChange={(e) =>
                  setForm((s) => ({ ...s, nickname: e.target.value }))
                }
                placeholder="Nickname"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
              Phone
              <input
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="Phone"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
              Date of Birth
              <input
                type="date"
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.dateOfBirth}
                onChange={(e) =>
                  setForm((s) => ({ ...s, dateOfBirth: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
              Gender
              <select
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.gender}
                onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
              >
                <option value="">Gender</option>
                <option value="MALE">MALE</option>
                <option value="FEMALE">FEMALE</option>
              </select>
            </label>
            <div className="flex items-center justify-start md:justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-[#f3e5d6] px-6 py-2 text-[12px] font-semibold text-black/80 transition hover:bg-[#ead4c0] disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
          {saveError ? (
            <div className="mt-2 text-[12px] text-red-600">{saveError}</div>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
          <div className="text-[14px] font-semibold text-black">Customer List</div>
          <div className="mt-4 max-h-[420px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-[12px] text-black/80">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-black/50">
                  <th className="pb-3 font-semibold">Code</th>
                  <th className="pb-3 font-semibold">Full Name</th>
                  <th className="pb-3 font-semibold">Nickname</th>
                  <th className="pb-3 font-semibold">Phone</th>
                  <th className="pb-3 font-semibold">Date of Birth</th>
                  <th className="pb-3 font-semibold">Gender</th>
                  <th className="pb-3 font-semibold">Wallet</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((row) => (
                  <tr key={row.customer_id} className="border-t border-black/5">
                    <td className="py-2 whitespace-nowrap">
                      {row.customer_id ? (
                        <Link
                          to={`/customer/${row.customer_id}`}
                          className="font-semibold text-[#3e342c] hover:text-black"
                        >
                          {row.customer_code || "-"}
                        </Link>
                      ) : (
                        row.customer_code || "-"
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">{row.full_name || "-"}</td>
                    <td className="py-2 whitespace-nowrap">{row.nickname || "-"}</td>
                    <td className="py-2 whitespace-nowrap">{row.phone || "-"}</td>
                    <td className="py-2 whitespace-nowrap">{row.date_of_birth || "-"}</td>
                    <td className="py-2 whitespace-nowrap">{row.gender || "-"}</td>
                    <td className="py-2 whitespace-nowrap">
                      {row.member_wallet_remain ?? "-"}
                    </td>
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
        </div>
      </div>
    </section>
  );
}
