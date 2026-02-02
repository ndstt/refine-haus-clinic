import React, { useEffect, useState, useRef } from "react";

const apiBase =
  import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

function formatCurrency(value) {
  if (value == null) return "฿0";
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatTime(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function StatsCard({ label, value, subValue, subColor }) {
  return (
    <div className="flex flex-col rounded-xl border-2 border-black/10 bg-white p-5 shadow-sm">
      <div className="text-sm text-black/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-black">{value}</div>
      {subValue && (
        <div className={`mt-1 text-xs ${subColor || "text-black/40"}`}>
          {subValue}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border-2 border-black/10 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-black/60">
        {title}
      </h3>
      {children}
    </div>
  );
}

function RevenueChart({ data }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const chartRef = useRef(null);

  if (!data || data.length === 0) {
    return <div className="text-center text-black/40">No data available</div>;
  }

  const amounts = data.map((d) => Number(d.amount) || 0);
  const maxAmount = Math.max(...amounts, 1);

  const padding = { top: 15, right: 15, bottom: 25, left: 15 };
  const width = 400;
  const height = 160;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((item, idx) => {
    const x = padding.left + (idx / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((Number(item.amount) || 0) / maxAmount) * chartHeight;
    return { x, y, amount: Number(item.amount) || 0, date: item.date, idx };
  });

  const createSmoothPath = (pts) => {
    if (pts.length < 2) return "";
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const linePath = createSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  const labelIndices = data.length <= 7
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  const activePoint = activeIdx !== null ? points[activeIdx] : null;

  return (
    <div className="relative" ref={chartRef}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b9ab93" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#b9ab93" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - ratio)}
            x2={width - padding.right}
            y2={padding.top + chartHeight * (1 - ratio)}
            stroke="rgba(0,0,0,0.05)"
            strokeDasharray="4,4"
          />
        ))}

        <path d={areaPath} fill="url(#areaGradient)" />

        <path
          d={linePath}
          fill="none"
          stroke="#b9ab93"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padding.top}
            x2={activePoint.x}
            y2={padding.top + chartHeight}
            stroke="#b9ab93"
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.5"
          />
        )}

        {points.map((p, idx) => (
          <circle
            key={`hover-${idx}`}
            cx={p.x}
            cy={p.y}
            r="12"
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setActiveIdx(idx)}
            onMouseLeave={() => setActiveIdx(null)}
            onClick={() => setActiveIdx(activeIdx === idx ? null : idx)}
          />
        ))}

        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={activeIdx === idx ? 5 : 3}
            fill={activeIdx === idx ? "#9b8a6f" : "#b9ab93"}
            stroke="white"
            strokeWidth="2"
            className="transition-all duration-150"
            style={{ opacity: activeIdx === null || activeIdx === idx ? 1 : 0.3 }}
          />
        ))}

        {labelIndices.map((idx) => (
          <text
            key={idx}
            x={points[idx].x}
            y={height - 5}
            textAnchor="middle"
            className="fill-black/40 text-[10px]"
          >
            {new Date(data[idx].date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
          </text>
        ))}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-black/10 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100 - 8}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="whitespace-nowrap text-[11px] text-black/50">
            {new Date(activePoint.date).toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
          <div className="text-sm font-semibold text-[#9b7a2f]">
            {formatCurrency(activePoint.amount)}
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentsList({ appointments }) {
  if (!appointments || appointments.length === 0) {
    return <div className="text-center text-black/40">No appointments scheduled</div>;
  }

  return (
    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
      {appointments.map((apt) => (
        <div
          key={apt.appointment_id}
          className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-black/70">
              {formatTime(apt.appointment_time)}
            </span>
            <span className="text-sm text-black">
              {apt.customer_name || "Unknown"}
            </span>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              apt.appointment_status === "COMPLETE"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {apt.appointment_status === "COMPLETE" ? "Complete" : "Pending"}
          </span>
        </div>
      ))}
    </div>
  );
}

const PIE_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16"
];

function TreatmentsPieChart({ treatments }) {
  if (!treatments || treatments.length === 0) {
    return <div className="text-center text-black/40 py-8">No data available</div>;
  }

  const total = treatments.reduce((sum, t) => sum + t.count, 0);
  const size = 140;
  const center = size / 2;
  const radius = 55;

  let currentAngle = -90;
  const slices = treatments.map((t, idx) => {
    const percentage = (t.count / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      ...t,
      percentage,
      path,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    };
  });

  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice, idx) => (
            <path
              key={idx}
              d={slice.path}
              fill={slice.color}
              stroke="white"
              strokeWidth="1"
              className="transition-opacity hover:opacity-80"
            >
              <title>{`${slice.treatment_name}: ${slice.count} sessions (${slice.percentage.toFixed(1)}%)`}</title>
            </path>
          ))}
          <circle cx={center} cy={center} r="30" fill="white" />
          <text x={center} y={center - 5} textAnchor="middle" className="text-lg font-bold fill-black">
            {total}
          </text>
          <text x={center} y={center + 10} textAnchor="middle" className="text-[9px] fill-black/50">
            sessions
          </text>
        </svg>
      </div>

      <div className="flex-1 max-h-36 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          {slices.map((slice, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1 truncate text-black/70" title={slice.treatment_name}>
                {slice.treatment_name}
              </span>
              <span className="font-medium text-black">
                {slice.count} <span className="text-black/50">({slice.percentage.toFixed(1)}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpiringItemsList({ items, expiringSoon }) {
  if (!items || items.length === 0) {
    return <div className="text-center text-black/40">No expiring items</div>;
  }

  const getStatusStyle = (daysUntil) => {
    if (daysUntil <= 7) return "bg-red-100 text-red-700";
    if (daysUntil <= 30) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  const getStatusText = (daysUntil) => {
    if (daysUntil === 0) return "Expires today";
    if (daysUntil === 1) return "1 day left";
    return `${daysUntil} days left`;
  };

  return (
    <div>
      <div className="mb-3 text-xs">
        <span className="rounded bg-yellow-100 px-2 py-1 text-yellow-700">
          Expiring within 30 days: {expiringSoon}
        </span>
      </div>
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {items.map((item, idx) => (
          <div
            key={`${item.item_id}-${idx}`}
            className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-black">
                {item.name || "-"}
              </span>
              <span className="text-xs text-black/40">
                {item.sku} {item.variant_name ? `• ${item.variant_name}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {item.qty != null && (
                <span className="text-xs text-black/50">{item.qty} pcs</span>
              )}
              <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusStyle(item.days_until_expire)}`}>
                {getStatusText(item.days_until_expire)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyStockTable({ items }) {
  if (!items || items.length === 0) {
    return <div className="text-center text-black/40">No stock data available</div>;
  }

  return (
    <div className="max-h-60 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-black/10 text-left text-xs text-black/50">
            <th className="pb-2 font-medium">SKU</th>
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Variant</th>
            <th className="pb-2 text-right font-medium">Stock</th>
            <th className="pb-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.item_id} className="border-b border-black/5">
              <td className="py-2 text-black/60">{item.sku || "-"}</td>
              <td className="py-2 text-black">{item.name || "-"}</td>
              <td className="py-2 text-black/60">{item.variant_name || "-"}</td>
              <td className={`py-2 text-right font-medium ${item.qty <= 0 ? "text-red-600" : item.qty <= 10 ? "text-yellow-600" : "text-green-600"}`}>
                {item.qty}
              </td>
              <td className="py-2 text-right">
                {item.change != null ? (
                  <span className={`text-xs font-medium ${item.change > 0 ? "text-green-600" : item.change < 0 ? "text-red-600" : "text-black/40"}`}>
                    {item.change > 0 ? `+${item.change}` : item.change === 0 ? "0" : item.change}
                  </span>
                ) : (
                  <span className="text-xs text-black/30">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompletedTodayTable({ items, totalCount, totalAmount }) {
  if (!items || items.length === 0) {
    return <div className="text-center text-black/40">No transactions</div>;
  }

  return (
    <div>
      <div className="max-h-60 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-left text-xs text-black/50">
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 font-medium">Customer</th>
              <th className="pb-2 font-medium">Treatment</th>
              <th className="pb-2 text-right font-medium">Amount</th>
              <th className="pb-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sell_invoice_id} className="border-b border-black/5">
                <td className="py-2 text-black/60">{formatTime(item.issue_at)}</td>
                <td className="py-2 text-black">{item.customer_name || "-"}</td>
                <td className="py-2 text-black/60">{item.treatment_name || "-"}</td>
                <td className="py-2 text-right font-medium text-black">
                  {formatCurrency(item.final_amount)}
                </td>
                <td className="py-2 text-center">
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Paid</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-4 border-t border-black/20 pt-3 text-sm">
        <span className="font-semibold text-black">Total: {totalCount} transactions</span>
        <span className="font-semibold text-[#9b7a2f]">{formatCurrency(totalAmount)}</span>
      </div>
    </div>
  );
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [revenueChart, setRevenueChart] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [topTreatments, setTopTreatments] = useState(null);
  const [expiringItems, setExpiringItems] = useState(null);
  const [dailyStock, setDailyStock] = useState(null);
  const [completedToday, setCompletedToday] = useState(null);
  const [chartDays, setChartDays] = useState(7);
  const [treatmentPeriod, setTreatmentPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const isToday = selectedDate === getTodayString();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const dateParam = `target_date=${selectedDate}`;
      try {
        const [statsRes, apptRes, treatRes, expiringRes, stockRes, completedRes] =
          await Promise.all([
            fetch(`${apiBase}/dashboard/stats?${dateParam}`),
            fetch(`${apiBase}/dashboard/appointments?${dateParam}`),
            fetch(`${apiBase}/dashboard/top-treatments?${dateParam}&period=${treatmentPeriod}`),
            fetch(`${apiBase}/dashboard/expiring-items?${dateParam}`),
            fetch(`${apiBase}/dashboard/daily-stock?${dateParam}`),
            fetch(`${apiBase}/dashboard/completed-today?${dateParam}`),
          ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (apptRes.ok) setAppointments(await apptRes.json());
        if (treatRes.ok) setTopTreatments(await treatRes.json());
        if (expiringRes.ok) setExpiringItems(await expiringRes.json());
        if (stockRes.ok) setDailyStock(await stockRes.json());
        if (completedRes.ok) setCompletedToday(await completedRes.json());
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, [selectedDate, treatmentPeriod]);

  useEffect(() => {
    async function fetchChart() {
      try {
        const res = await fetch(
          `${apiBase}/dashboard/revenue-chart?days=${chartDays}&end_date=${selectedDate}`
        );
        if (res.ok) setRevenueChart(await res.json());
      } catch (err) {
        console.error("Failed to fetch revenue chart:", err);
      }
    }
    fetchChart();
  }, [chartDays, selectedDate]);

  if (loading) {
    return (
      <section className="min-h-screen bg-[#f6eadb]">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-black/40">Loading...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#f6eadb] px-6 py-8">
      <div className="mx-auto w-full max-w-[1200px]">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Dashboard</h1>
          <p className="text-sm text-black/50">
            {isToday ? "Today's business overview" : "Historical data"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min="2024-01-01"
            max={getTodayString()}
            className="rounded-lg border border-black/20 px-3 py-2 text-sm focus:border-[#b9ab93] focus:outline-none focus:ring-1 focus:ring-[#b9ab93]"
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(getTodayString())}
              className="rounded-lg bg-[#b9ab93] px-3 py-2 text-sm font-medium text-white hover:bg-[#9b8a6f]"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label={isToday ? "Today's Revenue" : "Revenue"}
          value={formatCurrency(stats?.revenue_today)}
          subValue={
            stats?.revenue_change_percent != null
              ? `${stats.revenue_change_percent >= 0 ? "+" : ""}${stats.revenue_change_percent.toFixed(1)}% from previous day`
              : null
          }
          subColor={
            stats?.revenue_change_percent >= 0 ? "text-green-600" : "text-red-500"
          }
        />
        <StatsCard
          label={isToday ? "Today's Appointments" : "Appointments"}
          value={stats?.appointments_today || 0}
          subValue={`Pending: ${stats?.appointments_incomplete || 0} | Complete: ${stats?.appointments_complete || 0}`}
        />
        <StatsCard
          label="Promotions Used"
          value={stats?.promotions_used_today || 0}
          subValue={
            stats?.promotions_discount_today
              ? formatCurrency(-stats.promotions_discount_today)
              : null
          }
          subColor="text-red-500"
        />
        <StatsCard
          label="Low Stock Items"
          value={dailyStock?.low_stock_count || 0}
          subValue="items with qty ≤ 10"
          subColor="text-yellow-600"
        />
      </div>

      {/* Revenue Chart & Appointments */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Revenue">
          <div className="mb-4 flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setChartDays(d)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  chartDays === d
                    ? "bg-[#b9ab93] text-white"
                    : "bg-black/5 text-black/60 hover:bg-black/10"
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>
          <RevenueChart data={revenueChart?.data} />
          {revenueChart && (
            <div className="mt-3 text-right text-sm text-black/50">
              Total: <span className="font-semibold text-black">{formatCurrency(revenueChart.total)}</span>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Appointments">
          <AppointmentsList appointments={appointments?.appointments} />
          {appointments && (
            <div className="mt-3 flex justify-end gap-4 text-xs text-black/50">
              <span>Pending: {appointments.incomplete}</span>
              <span>Complete: {appointments.complete}</span>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Top Treatments & Expiring Items */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border-2 border-black/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-black/60">
              Top Treatments
            </h3>
            <div className="flex gap-1">
              {[
                { key: "day", label: "Day" },
                { key: "week", label: "Week" },
                { key: "month", label: "Month" },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setTreatmentPeriod(p.key)}
                  className={`rounded px-2 py-1 text-[10px] font-medium transition ${
                    treatmentPeriod === p.key
                      ? "bg-[#b9ab93] text-white"
                      : "bg-black/5 text-black/60 hover:bg-black/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <TreatmentsPieChart treatments={topTreatments?.treatments} />
        </div>

        <SectionCard title="Expiring Items">
          <ExpiringItemsList
            items={expiringItems?.items}
            expiringSoon={expiringItems?.expiring_soon || 0}
          />
        </SectionCard>
      </div>

      {/* Daily Stock */}
      <SectionCard title="Daily Stock" className="mb-6">
        <DailyStockTable items={dailyStock?.items} />
      </SectionCard>

      {/* Completed Transactions */}
      <SectionCard title="Completed Transactions">
        <CompletedTodayTable
          items={completedToday?.items}
          totalCount={completedToday?.total_count}
          totalAmount={completedToday?.total_amount}
        />
      </SectionCard>
      </div>
    </section>
  );
}
