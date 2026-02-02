import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
  if (!data || data.length === 0) {
    return <div className="text-center text-black/40">ไม่มีข้อมูล</div>;
  }

  const maxAmount = Math.max(...data.map((d) => Number(d.amount) || 0), 1);

  return (
    <div className="flex h-40 items-end justify-between gap-2">
      {data.map((item, idx) => {
        const height = Math.max((Number(item.amount) / maxAmount) * 100, 4);
        const dayName = new Date(item.date).toLocaleDateString("th-TH", { weekday: "short" });
        return (
          <div key={idx} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full max-w-[32px] rounded-t bg-[#b9ab93] transition-all hover:bg-[#9b8a6f]"
              style={{ height: `${height}%` }}
              title={`${formatDate(item.date)}: ${formatCurrency(item.amount)}`}
            />
            <span className="text-[10px] text-black/40">{dayName}</span>
          </div>
        );
      })}
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
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
        <tfoot>
          <tr className="border-t border-black/20">
            <td colSpan={3} className="py-3 text-right font-semibold text-black">
              รวมวันนี้: {totalCount} รายการ
            </td>
            <td className="py-3 text-right font-semibold text-[#9b7a2f]">
              {formatCurrency(totalAmount)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
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

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [statsRes, apptRes, treatRes, promoRes, stockRes, completedRes] =
          await Promise.all([
            fetch(`${API_BASE}/api/v1/dashboard/stats`),
            fetch(`${API_BASE}/api/v1/dashboard/appointments`),
            fetch(`${API_BASE}/api/v1/dashboard/top-treatments`),
            fetch(`${API_BASE}/api/v1/dashboard/promotions-used`),
            fetch(`${API_BASE}/api/v1/dashboard/out-of-stock`),
            fetch(`${API_BASE}/api/v1/dashboard/completed-today`),
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
  }, []);

  useEffect(() => {
    async function fetchChart() {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/dashboard/revenue-chart?days=${chartDays}`
        );
        if (res.ok) setRevenueChart(await res.json());
      } catch (err) {
        console.error("Failed to fetch revenue chart:", err);
      }
    }
    fetchChart();
  }, [chartDays]);

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
      <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Dashboard</h1>
          <p className="text-sm text-black/50">ภาพรวมธุรกิจวันนี้</p>
        </div>
        <div className="text-sm text-black/50">{today}</div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          icon="💰"
          label="รายได้วันนี้"
          value={formatCurrency(stats?.revenue_today)}
          subValue={
            stats?.revenue_change_percent != null
              ? `${stats.revenue_change_percent >= 0 ? "+" : ""}${stats.revenue_change_percent.toFixed(1)}% จากเมื่อวาน`
              : null
          }
          subColor={
            stats?.revenue_change_percent >= 0 ? "text-green-600" : "text-red-500"
          }
        />
        <StatsCard
          icon="📅"
          label="นัดหมายวันนี้"
          value={stats?.appointments_today || 0}
          subValue={`🟡 ${stats?.appointments_incomplete || 0}  ✅ ${stats?.appointments_complete || 0}`}
        />
        <StatsCard
          icon="🎁"
          label="โปรโมที่ใช้"
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
