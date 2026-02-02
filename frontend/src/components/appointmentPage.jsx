import { useEffect, useState } from "react";

const STATUS_OPTIONS = ["INCOMPLETE", "COMPLETE"];

export default function AppointmentPage() {
  const apiBase =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({
    customerQuery: "",
    customerId: "",
    appointmentTime: "",
    status: "INCOMPLETE",
  });
  const [customerOptions, setCustomerOptions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadAppointments() {
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${apiBase}/appointment`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setAppointments(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setAppointments([]);
      setLoadError("Cannot load appointments. Check backend connection.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  async function updateStatus(appointmentId, nextStatus) {
    if (!appointmentId) return;
    setSavingId(appointmentId);
    setSaveError("");
    try {
      const res = await fetch(`${apiBase}/appointment/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Request failed (${res.status})`);
      }
      const updated = await res.json();
      setAppointments((prev) =>
        prev.map((row) =>
          row.appointment_id === appointmentId ? { ...row, ...updated } : row
        )
      );
    } catch (err) {
      setSaveError(err?.message || "Update failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function createAppointment(e) {
    e.preventDefault();
    setCreateError("");
    const customerId = Number(form.customerId);
    if (!customerId) {
      setCreateError("Customer ID is required.");
      return;
    }
    if (!form.appointmentTime) {
      setCreateError("Appointment time is required.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`${apiBase}/appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          appointment_time: form.appointmentTime,
          appointment_status: form.status || "INCOMPLETE",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Request failed (${res.status})`);
      }
      const created = await res.json();
      setAppointments((prev) => [created, ...prev]);
      setForm({
        customerQuery: "",
        customerId: "",
        appointmentTime: "",
        status: "INCOMPLETE",
      });
    } catch (err) {
      setCreateError(err?.message || "Create failed.");
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    const query = form.customerQuery.trim();
    if (!query) {
      setCustomerOptions([]);
      return;
    }
    let isMounted = true;
    setIsSearching(true);
    fetch(`${apiBase}/resource/customer?query=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setCustomerOptions(Array.isArray(data.customers) ? data.customers : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setCustomerOptions([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsSearching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiBase, form.customerQuery]);

  return (
    <section className="bg-[#f6eadb] px-6 py-10">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 shadow-sm">
          <div className="text-[18px] font-semibold text-black">Appointment</div>
          <p className="mt-1 text-[12px] text-black/50">
            Create appointments and update status (COMPLETE / INCOMPLETE)
          </p>

          <form
            onSubmit={createAppointment}
            className="mt-4 grid gap-3 md:grid-cols-3"
          >
            <div className="flex flex-col gap-1 text-[12px] font-semibold text-black/70 md:col-span-3">
              Customer (Name or Code)
              <input
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.customerQuery}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    customerQuery: e.target.value,
                    customerId: "",
                  }))
                }
                placeholder="Type name or customer code"
              />
              {isSearching ? (
                <div className="text-[11px] font-normal text-black/40">
                  Loading...
                </div>
              ) : null}
              {customerOptions.length ? (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-black/10 bg-white">
                  {customerOptions.map((option) => (
                    <button
                      key={option.customer_id}
                      type="button"
                      onClick={() =>
                        setForm((s) => ({
                          ...s,
                          customerQuery: option.full_name || option.customer_code || "",
                          customerId: String(option.customer_id),
                        }))
                      }
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-black/70 hover:bg-black/5"
                    >
                      <span>{option.full_name || "-"}</span>
                      <span className="text-[11px] text-black/40">
                        {option.customer_code || option.customer_id}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {form.customerId ? (
                <div className="text-[11px] font-normal text-black/50">
                  Selected: {form.customerQuery}
                </div>
              ) : null}
            </div>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
              Appointment Time
              <input
                type="datetime-local"
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.appointmentTime}
                onChange={(e) =>
                  setForm((s) => ({ ...s, appointmentTime: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-black/70">
              Status
              <select
                className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-2 text-[13px] font-normal"
                value={form.status}
                onChange={(e) =>
                  setForm((s) => ({ ...s, status: e.target.value }))
                }
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end md:col-span-3 md:justify-end">
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-full bg-[#f3e5d6] px-6 py-2 text-[12px] font-semibold text-black/80 transition hover:bg-[#ead4c0] disabled:opacity-60"
              >
                {isCreating ? "Saving..." : "Add Appointment"}
              </button>
            </div>
          </form>
          {createError ? (
            <div className="mt-2 text-[12px] text-red-600">{createError}</div>
          ) : null}

          <div className="mt-4 max-h-[520px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-[12px] text-black/80">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-black/50">
                  <th className="pb-3 font-semibold">Code</th>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Time</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((row) => (
                  <tr key={row.appointment_id} className="border-t border-black/5">
                    <td className="py-2 whitespace-nowrap">
                      {row.customer_code || "-"}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {row.full_name || "-"}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {formatDate(row.appointment_time)}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <select
                        className="rounded-lg border border-black/10 bg-[#f8efe7] px-3 py-1 text-[12px] font-semibold text-black/70"
                        value={row.appointment_status || "INCOMPLETE"}
                        onChange={(e) =>
                          updateStatus(row.appointment_id, e.target.value)
                        }
                        disabled={savingId === row.appointment_id}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {!appointments.length ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-[12px] text-black/40"
                    >
                      No appointments
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
          {saveError ? (
            <div className="mt-3 text-[12px] text-red-600">{saveError}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
