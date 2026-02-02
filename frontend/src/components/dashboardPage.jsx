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
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function StatsCard({ icon, label, value, subValue, subColor }) {
  return (
    <div className="flex flex-col rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-black/50">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
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
    <div className={`rounded-xl border border-black/10 bg-white p-5 shadow-sm ${className}`}>
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
    return <div className="text-center text-black/40">ไม่มีข้อมูล</div>;
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

  // Smooth curve path using cardinal spline
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

  // Show labels
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

        {/* Grid lines */}
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

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#b9ab93"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Active vertical line */}
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

        {/* Hover areas (invisible, larger hit targets) */}
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

        {/* Visible points - only show active or on hover */}
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

        {/* X-axis labels */}
        {labelIndices.map((idx) => (
          <text
            key={idx}
            x={points[idx].x}
            y={height - 5}
            textAnchor="middle"
            className="fill-black/40 text-[10px]"
          >
            {new Date(data[idx].date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
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
            {new Date(activePoint.date).toLocaleDateString("th-TH", {
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
    return <div className="text-center text-black/40">ไม่มีนัดหมายวันนี้</div>;
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
              {apt.customer_name || "ไม่ระบุชื่อ"}
            </span>
          </div>
          <span>
            {apt.appointment_status === "COMPLETE" ? (
              <span className="text-green-600">✅</span>
            ) : (
              <span className="text-yellow-500">🟡</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function TopTreatmentsList({ treatments }) {
  if (!treatments || treatments.length === 0) {
    return <div className="text-center text-black/40">ไม่มีข้อมูล</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {treatments.map((t, idx) => (
        <div
          key={t.treatment_id}
          className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#b9ab93] text-xs font-semibold text-white">
              {idx + 1}
            </span>
            <span className="text-sm text-black">{t.treatment_name}</span>
          </div>
          <span className="text-sm font-medium text-black/60">{t.count} ครั้ง</span>
        </div>
      ))}
    </div>
  );
}

function PromotionsList({ promotions }) {
  if (!promotions || promotions.length === 0) {
    return <div className="text-center text-black/40">ไม่มีข้อมูล</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {promotions.map((p) => (
        <div
          key={p.promotion_id}
          className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium text-black">
              {p.promotion_code || p.promotion_name || "ไม่ระบุ"}
            </span>
            <span className="text-xs text-black/40">
              {formatCurrency(-p.total_discount)}
            </span>
          </div>
          <span className="text-sm text-black/60">{p.usage_count} ครั้ง</span>
        </div>
      ))}
    </div>
  );
}

function OutOfStockTable({ items }) {
  if (!items || items.length === 0) {
    return <div className="text-center text-black/40">ไม่มีสินค้าหมด</div>;
  }

  return (
    <div className="max-h-60 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-black/10 text-left text-xs text-black/50">
            <th className="pb-2 font-medium">SKU</th>
            <th className="pb-2 font-medium">ชื่อ</th>
            <th className="pb-2 font-medium">Variant</th>
            <th className="pb-2 text-right font-medium">คงเหลือ</th>
            <th className="pb-2 text-center font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.item_id} className="border-b border-black/5">
              <td className="py-2 text-black/60">{item.sku || "-"}</td>
              <td className="py-2 text-black">{item.name || "-"}</td>
              <td className="py-2 text-black/60">{item.variant_name || "-"}</td>
              <td className="py-2 text-right font-medium text-red-600">
                {item.current_qty}
              </td>
              <td className="py-2 text-center">
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                  🔴 หมด
                </span>
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
    return <div className="text-center text-black/40">ไม่มีรายการวันนี้</div>;
  }

  return (
    <div>
      <div className="max-h-60 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-left text-xs text-black/50">
              <th className="pb-2 font-medium">เวลา</th>
              <th className="pb-2 font-medium">ลูกค้า</th>
              <th className="pb-2 font-medium">Treatment</th>
              <th className="pb-2 text-right font-medium">ราคา</th>
              <th className="pb-2 text-center font-medium">สถานะ</th>
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
                  <span className="text-green-600">✅ PAID</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-4 border-t border-black/20 pt-3 text-sm">
        <span className="font-semibold text-black">รวมวันนี้: {totalCount} รายการ</span>
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
  const [promotionsUsed, setPromotionsUsed] = useState(null);
  const [outOfStock, setOutOfStock] = useState(null);
  const [completedToday, setCompletedToday] = useState(null);
  const [chartDays, setChartDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const isToday = selectedDate === getTodayString();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const dateParam = `target_date=${selectedDate}`;
      try {
        const [statsRes, apptRes, treatRes, promoRes, stockRes, completedRes] =
          await Promise.all([
            fetch(`${apiBase}/dashboard/stats?${dateParam}`),
            fetch(`${apiBase}/dashboard/appointments?${dateParam}`),
            fetch(`${apiBase}/dashboard/top-treatments?${dateParam}`),
            fetch(`${apiBase}/dashboard/promotions-used?${dateParam}`),
            fetch(`${apiBase}/dashboard/out-of-stock`),
            fetch(`${apiBase}/dashboard/completed-today?${dateParam}`),
          ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (apptRes.ok) setAppointments(await apptRes.json());
        if (treatRes.ok) setTopTreatments(await treatRes.json());
        if (promoRes.ok) setPromotionsUsed(await promoRes.json());
        if (stockRes.ok) setOutOfStock(await stockRes.json());
        if (completedRes.ok) setCompletedToday(await completedRes.json());
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, [selectedDate]);

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

  const today = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-black/40">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Dashboard</h1>
          <p className="text-sm text-black/50">
            {isToday ? "ภาพรวมธุรกิจวันนี้" : "ข้อมูลย้อนหลัง"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={getTodayString()}
            className="rounded-lg border border-black/20 px-3 py-2 text-sm focus:border-[#b9ab93] focus:outline-none focus:ring-1 focus:ring-[#b9ab93]"
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(getTodayString())}
              className="rounded-lg bg-[#b9ab93] px-3 py-2 text-sm font-medium text-white hover:bg-[#9b8a6f]"
            >
              วันนี้
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          icon="💰"
          label={isToday ? "รายได้วันนี้" : "รายได้"}
          value={formatCurrency(stats?.revenue_today)}
          subValue={
            stats?.revenue_change_percent != null
              ? `${stats.revenue_change_percent >= 0 ? "+" : ""}${stats.revenue_change_percent.toFixed(1)}% จากวันก่อน`
              : null
          }
          subColor={
            stats?.revenue_change_percent >= 0 ? "text-green-600" : "text-red-500"
          }
        />
        <StatsCard
          icon="📅"
          label={isToday ? "นัดหมายวันนี้" : "นัดหมาย"}
          value={stats?.appointments_today || 0}
          subValue={`🟡 ${stats?.appointments_incomplete || 0}  ✅ ${stats?.appointments_complete || 0}`}
        />
        <StatsCard
          icon="🎁"
          label={isToday ? "โปรโมที่ใช้" : "โปรโม"}
          value={stats?.promotions_used_today || 0}
          subValue={
            stats?.promotions_discount_today
              ? formatCurrency(-stats.promotions_discount_today)
              : null
          }
          subColor="text-red-500"
        />
        <StatsCard
          icon="⚠️"
          label="สินค้าหมด"
          value={stats?.out_of_stock_count || 0}
          subValue="ต้องสั่งซื้อ"
          subColor="text-red-500"
        />
      </div>

      {/* Revenue Chart & Appointments */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="📈 รายได้">
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
                {d} วัน
              </button>
            ))}
          </div>
          <RevenueChart data={revenueChart?.data} />
          {revenueChart && (
            <div className="mt-3 text-right text-sm text-black/50">
              รวม: <span className="font-semibold text-black">{formatCurrency(revenueChart.total)}</span>
            </div>
          )}
        </SectionCard>

        <SectionCard title="📆 นัดหมายวันนี้">
          <AppointmentsList appointments={appointments?.appointments} />
          {appointments && (
            <div className="mt-3 flex justify-end gap-4 text-xs text-black/50">
              <span>🟡 รอ: {appointments.incomplete}</span>
              <span>✅ เสร็จ: {appointments.complete}</span>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Top Treatments & Promotions */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="🏆 Treatment ยอดนิยม (เดือนนี้)">
          <TopTreatmentsList treatments={topTreatments?.treatments} />
        </SectionCard>

        <SectionCard title="🎁 โปรโมชั่นที่ใช้ (เดือนนี้)">
          <PromotionsList promotions={promotionsUsed?.promotions} />
        </SectionCard>
      </div>

      {/* Out of Stock */}
      <SectionCard title="⚠️ สินค้าหมด (qty ≤ 0)" className="mb-6">
        <OutOfStockTable items={outOfStock?.items} />
      </SectionCard>

      {/* Completed Today */}
      <SectionCard title="✅ รายการที่เสร็จสิ้นวันนี้">
        <CompletedTodayTable
          items={completedToday?.items}
          totalCount={completedToday?.total_count}
          totalAmount={completedToday?.total_amount}
        />
      </SectionCard>
    </div>
  );
}
