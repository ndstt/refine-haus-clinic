import ReactECharts from "echarts-for-react";

const PRESET_MAP = {
  executive: {
    colors: ["#0f766e", "#1d4ed8", "#b45309", "#be185d", "#166534"],
    fontSize: 12,
    lineWidth: 2,
  },
  compact: {
    colors: ["#334155", "#0284c7", "#16a34a", "#ca8a04", "#dc2626"],
    fontSize: 11,
    lineWidth: 2,
  },
  clean: {
    colors: ["#2563eb", "#0d9488", "#ea580c", "#7c3aed", "#475569"],
    fontSize: 12,
    lineWidth: 2,
  },
  presentation: {
    colors: ["#312e81", "#0891b2", "#65a30d", "#c2410c", "#be123c"],
    fontSize: 13,
    lineWidth: 3,
  },
};

function getPreset(stylePreset) {
  return PRESET_MAP[stylePreset] ?? PRESET_MAP.clean;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function humanizeField(value) {
  if (!value || typeof value !== "string") return "";
  const cleaned = value.replace(/[_\s]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function resolveTitle(payload, chartType, datasets) {
  const explicitTitle =
    typeof payload.title === "string" ? payload.title.trim() : "";
  if (explicitTitle) return explicitTitle;

  const xField = humanizeField(payload.x_field);
  const yField = humanizeField(payload.y_field);
  if (xField && yField) {
    if (chartType === "scatter") return `${yField} vs ${xField}`;
    if (chartType === "pie") return `Share of ${yField} by ${xField}`;
    return `${yField} by ${xField}`;
  }

  const firstLabel = humanizeField(datasets?.[0]?.label);
  if (firstLabel) return firstLabel;
  return "Visualization";
}

function getYValues(chartType, datasets) {
  if (!Array.isArray(datasets) || datasets.length === 0) return [];
  if (chartType === "scatter") {
    return datasets.flatMap((dataset) =>
      Array.isArray(dataset.data)
        ? dataset.data.map((point) => toNumber(point?.y))
        : []
    );
  }
  return datasets.flatMap((dataset) =>
    Array.isArray(dataset.data)
      ? dataset.data.map((value) => toNumber(value))
      : []
  );
}

function getScaleConfig(formatKind, chartType, datasets) {
  const values = getYValues(chartType, datasets);
  const maxAbs = values.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);

  if (formatKind !== "currency_thb") {
    return {
      divisor: 1,
      axisUnit: "",
      tooltipUnit: "",
    };
  }

  if (maxAbs >= 1_000_000) {
    return {
      divisor: 1_000_000,
      axisUnit: "\u0e25\u0e49\u0e32\u0e19\u0e1a\u0e32\u0e17",
      tooltipUnit: "\u0e25\u0e49\u0e32\u0e19\u0e1a\u0e32\u0e17",
    };
  }

  return {
    divisor: 1,
    axisUnit: "\u0e1a\u0e32\u0e17",
    tooltipUnit: "\u0e1a\u0e32\u0e17",
  };
}

function numberFormatter(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits,
  }).format(toNumber(value));
}

function yAxisFormatter(formatKind, scaleConfig) {
  if (formatKind === "currency_thb") {
    if (scaleConfig.divisor > 1) {
      return (value) => numberFormatter(toNumber(value) / scaleConfig.divisor);
    }
    return (value) =>
      new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 2,
      }).format(toNumber(value));
  }
  if (formatKind === "percent") {
    return (value) => `${toNumber(value).toFixed(2)}%`;
  }
  return (value) => numberFormatter(value, 0);
}

function tooltipValueFormatter(formatKind, scaleConfig) {
  if (formatKind === "currency_thb") {
    if (scaleConfig.divisor > 1) {
      return (value) =>
        `${numberFormatter(toNumber(value) / scaleConfig.divisor)} ${scaleConfig.tooltipUnit}`;
    }
    return (value) =>
      new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 2,
      }).format(toNumber(value));
  }
  if (formatKind === "percent") {
    return (value) => `${toNumber(value).toFixed(2)}%`;
  }
  return (value) => numberFormatter(value, 0);
}

function renderTable(records, titleText) {
  if (!Array.isArray(records) || records.length === 0) return null;

  const columns = Object.keys(records[0]);
  const rows = records.slice(0, 30);
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      {titleText ? (
        <div className="mb-3 text-[13px] font-semibold text-black/75">{titleText}</div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="bg-black/5">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-left font-medium text-black/70"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-black/5">
                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column}`}
                    className="px-3 py-2 text-black/70"
                  >
                    {row[column] == null ? "-" : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ChatPayloadChart({ payload }) {
  if (!payload || typeof payload !== "object") return null;

  const chartType = payload.chart_type ?? "bar";
  const datasets = Array.isArray(payload.datasets) ? payload.datasets : [];
  const titleText = resolveTitle(payload, chartType, datasets);

  if (chartType === "table") {
    return renderTable(payload.records, titleText);
  }
  if (datasets.length === 0) return null;

  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  const stylePreset = payload.style_preset ?? "clean";
  const formatConfig = payload.format ?? {};
  const display = payload.display ?? {};
  const preset = getPreset(stylePreset);
  const yFormat = formatConfig.y ?? "number";
  const scaleConfig = getScaleConfig(yFormat, chartType, datasets);

  const formatAxisY = yAxisFormatter(yFormat, scaleConfig);
  const formatTooltipY = tooltipValueFormatter(yFormat, scaleConfig);
  const showLegend = display.show_legend !== false;
  const showGrid = display.show_grid !== false;
  const smooth = display.smooth === true;
  const stacked = display.stacked === true;
  const hasTitle = Boolean(titleText);
  const isPie = chartType === "pie";
  const hasManyPieSlices = labels.length > 5;
  const useSideLegendForPie = isPie && labels.length > 4 && showLegend;
  const showPieLabels =
    display.label_mode === "all" ||
    (display.label_mode !== "none" && !hasManyPieSlices);

  const legendTop = hasTitle ? 38 : 8;
  const gridTop = showLegend ? (hasTitle ? 72 : 42) : hasTitle ? 48 : 20;

  const series = datasets.map((dataset, index) => {
    const color = preset.colors[index % preset.colors.length];
    if (chartType === "scatter") {
      return {
        name: dataset.label ?? `Series ${index + 1}`,
        type: "scatter",
        data: Array.isArray(dataset.data)
          ? dataset.data.map((point) => ({
              x: point?.x,
              y: toNumber(point?.y),
            }))
          : [],
        symbolSize: 8,
        itemStyle: { color },
      };
    }

    if (chartType === "pie") {
      const pieData = labels.map((label, labelIndex) => ({
        name: String(label),
        value: toNumber(dataset.data?.[labelIndex]),
      }));
      return {
        name: dataset.label ?? "Value",
        type: "pie",
        radius: useSideLegendForPie ? ["46%", "72%"] : ["42%", "70%"],
        center: useSideLegendForPie ? ["34%", "58%"] : ["50%", "58%"],
        avoidLabelOverlap: true,
        minShowLabelAngle: 4,
        data: pieData,
        label: {
          show: showPieLabels,
          formatter: "{b}\n{d}%",
          fontSize: preset.fontSize,
        },
        labelLine: {
          show: showPieLabels,
          length: 12,
          length2: 10,
          smooth: true,
        },
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 1,
        },
      };
    }

    return {
      name: dataset.label ?? `Series ${index + 1}`,
      type: chartType === "line" ? "line" : "bar",
      data: Array.isArray(dataset.data)
        ? dataset.data.map((value) => toNumber(value))
        : [],
      smooth,
      stack: stacked ? "total" : undefined,
      lineStyle: { width: preset.lineWidth },
      itemStyle: { color },
    };
  });

  const option = {
    color: preset.colors,
    textStyle: { fontSize: preset.fontSize, color: "rgba(0,0,0,0.75)" },
    title: hasTitle
      ? {
          text: titleText,
          left: "center",
          top: 6,
          textStyle: {
            fontSize: preset.fontSize + 2,
            fontWeight: 600,
            color: "rgba(0,0,0,0.82)",
          },
        }
      : undefined,
    tooltip: {
      trigger: isPie ? "item" : "axis",
      valueFormatter: isPie ? undefined : formatTooltipY,
      formatter: isPie
        ? (params) => {
            const name = params?.name ?? "";
            const seriesName = params?.seriesName ?? "";
            const value = formatTooltipY(params?.value);
            const percent = Number.isFinite(Number(params?.percent))
              ? ` (${toNumber(params.percent).toFixed(1)}%)`
              : "";
            return `${name}<br/>${seriesName}: ${value}${percent}`;
          }
        : undefined,
      axisPointer: isPie ? undefined : { type: "line" },
    },
    legend: showLegend
      ? {
          show: true,
          type: "scroll",
          orient: useSideLegendForPie ? "vertical" : "horizontal",
          top: useSideLegendForPie ? (hasTitle ? 52 : 18) : legendTop,
          left: useSideLegendForPie ? undefined : "center",
          right: useSideLegendForPie ? 8 : undefined,
          bottom: useSideLegendForPie ? 18 : undefined,
          width: useSideLegendForPie ? "34%" : undefined,
        }
      : { show: false },
    grid: isPie
      ? undefined
      : {
          left: 14,
          right: 12,
          bottom: 16,
          top: gridTop,
          containLabel: true,
        },
    xAxis:
      isPie || chartType === "scatter"
        ? chartType === "scatter"
          ? {
              type: "value",
              splitLine: { show: showGrid },
              axisLabel: {
                formatter: (value) => numberFormatter(value, 0),
              },
            }
          : undefined
        : {
            type: "category",
            data: labels.map((value) => String(value)),
            axisLabel: {
              hideOverlap: true,
              rotate: labels.length > 10 ? 25 : 0,
            },
            axisLine: { show: true },
          },
    yAxis: isPie
      ? undefined
      : {
          type: "value",
          splitLine: { show: showGrid },
          name:
            yFormat === "currency_thb" && scaleConfig.axisUnit
              ? scaleConfig.axisUnit
              : undefined,
          nameLocation: "end",
          nameGap: 12,
          axisLabel: { formatter: formatAxisY },
        },
    series,
  };

  const chartHeight = isPie ? 430 : 360;
  return (
    <div
      className="w-full rounded-xl border border-black/10 bg-white p-2"
      style={{ height: `${chartHeight}px` }}
    >
      <ReactECharts option={option} style={{ height: "100%", width: "100%" }} notMerge />
    </div>
  );
}
