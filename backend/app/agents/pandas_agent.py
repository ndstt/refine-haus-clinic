import ast
import inspect
import json
import logging
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pandas as pd
from langchain_core.tools import StructuredTool
from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent

from app.agents.prompts.pandas_agent import (
    CHART_TYPE_INFERENCE_PROMPT,
    SYSTEM_PROMPT,
)
from app.services.llm.open_ai import get_chat_llm

logger = logging.getLogger(__name__)
_pandas_agent = None
_pandas_agent_df_id = None

_SUPPORTED_FILTER_OPERATORS = {"=", "!=", ">", ">=", "<", "<=", "in", "contains"}
_SUPPORTED_AGG_FUNCTIONS = {"sum", "mean", "count", "min", "max", "median", "nunique"}
_SUPPORTED_WINDOW_FUNCTIONS = {"running_total", "rank", "dense_rank", "percent_of_total"}
_SUPPORTED_PIVOT_AGG_FUNCTIONS = {"sum", "mean", "count", "min", "max", "median"}
_SUPPORTED_RESAMPLE_AGG_FUNCTIONS = {"sum", "mean", "count", "min", "max", "median"}
_SUPPORTED_CHART_TYPES = {"bar", "line", "scatter", "pie", "table"}
_SUPPORTED_STYLE_PRESETS = {"executive", "compact", "clean", "presentation"}
_DEFAULT_FORMAT = {"x": "category", "y": "number"}
_PIE_MAX_SLICES = 6
_PIE_OTHER_LABEL = "Other"
_DEFAULT_DISPLAY = {
    "stacked": False,
    "smooth": False,
    "show_legend": True,
    "show_grid": True,
    "label_mode": "smart",
}


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if hasattr(value, "item"):
        try:
            return _to_jsonable(value.item())
        except Exception:
            pass
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return str(value)


def _records_from_dataframe(dataframe: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {str(key): _to_jsonable(value) for key, value in row.items()}
        for row in dataframe.to_dict(orient="records")
    ]


def _clamp_limit(limit: int, default_limit: int = 200, max_limit: int = 2000) -> int:
    if limit is None:
        return default_limit
    return max(1, min(int(limit), max_limit))


def _require_columns(dataframe: pd.DataFrame, columns: list[str]) -> None:
    missing = [column for column in columns if column not in dataframe.columns]
    if missing:
        raise ValueError(f"Columns not found: {', '.join(missing)}")


def _extract_json_object(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    candidates = [cleaned]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        candidates.append(cleaned[start : end + 1])

    for candidate in candidates:
        for parser in (json.loads, ast.literal_eval):
            try:
                value = parser(candidate)
            except Exception:
                continue
            if isinstance(value, dict):
                return value
    return None


def _humanize_field_name(name: str) -> str:
    cleaned = re.sub(r"[_\s]+", " ", str(name)).strip()
    if not cleaned:
        return "Value"
    return cleaned[:1].upper() + cleaned[1:]


def _default_chart_title(x: str, y: str, chart_type: str) -> str:
    x_label = _humanize_field_name(x)
    y_label = _humanize_field_name(y)
    if chart_type == "scatter":
        return f"{y_label} vs {x_label}"
    if chart_type == "pie":
        return f"Share of {y_label} by {x_label}"
    return f"{y_label} by {x_label}"


def _compact_user_question_title(user_question: str | None, max_len: int = 80) -> str:
    if not user_question:
        return ""
    cleaned = " ".join(str(user_question).strip().split())
    if not cleaned:
        return ""
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3].rstrip() + "..."


def _is_share_intent(user_question: str | None) -> bool:
    if not user_question:
        return False
    normalized = str(user_question).lower()
    keywords = (
        "share",
        "proportion",
        "distribution",
        "composition",
        "breakdown",
        "สัดส่วน",
        "สรุปสัดส่วน",
        "กระจาย",
        "แบ่งตาม",
    )
    return any(keyword in normalized for keyword in keywords)


def _is_generic_chart_title(title: str) -> bool:
    normalized = " ".join((title or "").strip().lower().split())
    generic_titles = {
        "",
        "visualization",
        "chart",
        "product sales overview",
        "distribution of categories",
    }
    return normalized in generic_titles


def _compress_pie_categories(
    dataframe: pd.DataFrame,
    x: str,
    y: str,
    max_slices: int = _PIE_MAX_SLICES,
    other_label: str = _PIE_OTHER_LABEL,
) -> pd.DataFrame:
    if dataframe.empty:
        return dataframe
    if max_slices < 2:
        max_slices = 2

    sorted_df = dataframe.sort_values(y, ascending=False, kind="stable").reset_index(drop=True)
    if len(sorted_df) <= max_slices:
        return sorted_df

    keep_count = max_slices - 1
    top_df = sorted_df.head(keep_count).copy()
    other_sum = float(sorted_df.iloc[keep_count:][y].sum())

    other_row = pd.DataFrame([{x: other_label, y: other_sum}])
    return pd.concat([top_df, other_row], ignore_index=True)


def _normalize_chart_design(payload: dict[str, Any]) -> dict[str, Any]:
    chart_type = str(payload.get("chart_type", "bar")).lower()
    if chart_type not in _SUPPORTED_CHART_TYPES:
        chart_type = "bar"

    style_preset = str(payload.get("style_preset", "clean")).lower()
    if style_preset not in _SUPPORTED_STYLE_PRESETS:
        style_preset = "clean"

    payload_format = payload.get("format")
    if not isinstance(payload_format, dict):
        payload_format = {}
    format_map = {
        "x": str(payload_format.get("x", _DEFAULT_FORMAT["x"])),
        "y": str(payload_format.get("y", _DEFAULT_FORMAT["y"])),
    }

    payload_display = payload.get("display")
    if not isinstance(payload_display, dict):
        payload_display = {}
    display = {
        "stacked": bool(payload_display.get("stacked", _DEFAULT_DISPLAY["stacked"])),
        "smooth": bool(payload_display.get("smooth", _DEFAULT_DISPLAY["smooth"])),
        "show_legend": bool(payload_display.get("show_legend", _DEFAULT_DISPLAY["show_legend"])),
        "show_grid": bool(payload_display.get("show_grid", _DEFAULT_DISPLAY["show_grid"])),
        "label_mode": str(payload_display.get("label_mode", _DEFAULT_DISPLAY["label_mode"])),
    }

    if display["label_mode"] not in {"none", "smart", "all"}:
        display["label_mode"] = _DEFAULT_DISPLAY["label_mode"]

    title = str(payload.get("title", "")).strip()
    if len(title) > 80:
        title = title[:80].rstrip()

    return {
        "title": title,
        "chart_type": chart_type,
        "style_preset": style_preset,
        "format": format_map,
        "display": display,
    }


def _infer_chart_design_with_llm(
    records: list[dict[str, Any]],
    x: str,
    y: str,
    series: str | None,
    user_question: str | None = None,
) -> dict[str, Any]:
    try:
        sample = records[:30]
        llm = get_chat_llm()
        prompt = CHART_TYPE_INFERENCE_PROMPT.format(
            user_question=user_question or "none",
            x=x,
            y=y,
            series=series if series else "none",
            sample_json=sample,
        )
        response = llm.invoke(prompt)
        content = getattr(response, "content", response)
        if isinstance(content, list):
            content = " ".join(
                str(item.get("text", item)) if isinstance(item, dict) else str(item)
                for item in content
            )
        parsed = _extract_json_object(str(content))
        if parsed:
            return _normalize_chart_design(parsed)
        text = str(content).strip().lower()
        match = re.search(r"\b(bar|line|scatter|pie|table)\b", text)
        if match:
            return _normalize_chart_design({"chart_type": match.group(1)})
    except Exception as exc:
        logger.warning("Chart design inference failed, fallback defaults: %s", exc)

    return _normalize_chart_design({})


def tool_get_schema(dataframe: pd.DataFrame) -> dict[str, Any]:
    """Return DataFrame schema metadata for agent reasoning."""
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")

    columns = list(dataframe.columns)
    dtypes = {column: str(dtype) for column, dtype in dataframe.dtypes.items()}
    null_count = {column: int(dataframe[column].isna().sum()) for column in columns}

    return {
        "row_count": int(len(dataframe)),
        "column_count": int(len(columns)),
        "columns": columns,
        "dtypes": dtypes,
        "null_count": null_count,
    }


def tool_preview_rows(dataframe: pd.DataFrame, limit: int = 10) -> list[dict[str, Any]]:
    """Return JSON-safe preview rows."""
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")
    if limit <= 0:
        return []

    safe_limit = min(int(limit), 100)
    preview_df = dataframe.head(safe_limit)
    return _records_from_dataframe(preview_df)


def tool_filter_rows(dataframe: pd.DataFrame, filters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter rows with standard operators: =, !=, >, >=, <, <=, in, contains."""
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")
    if not filters:
        return _records_from_dataframe(dataframe)

    filtered_df = dataframe.copy()

    for item in filters:
        if not isinstance(item, dict):
            raise ValueError("Each filter must be a dict.")

        column = item.get("column")
        operator = str(item.get("op", "=")).lower()
        value = item.get("value")

        if not column:
            raise ValueError("Filter requires 'column'.")
        if operator not in _SUPPORTED_FILTER_OPERATORS:
            raise ValueError(f"Unsupported filter operator: {operator}")
        _require_columns(filtered_df, [column])

        series = filtered_df[column]

        if operator == "=":
            mask = series == value
        elif operator == "!=":
            mask = series != value
        elif operator == ">":
            mask = series > value
        elif operator == ">=":
            mask = series >= value
        elif operator == "<":
            mask = series < value
        elif operator == "<=":
            mask = series <= value
        elif operator == "in":
            values = value if isinstance(value, list) else [value]
            mask = series.isin(values)
        elif operator == "contains":
            pattern = "" if value is None else str(value)
            case_sensitive = bool(item.get("case_sensitive", False))
            mask = series.astype(str).str.contains(pattern, case=case_sensitive, na=False)
        else:
            raise ValueError(f"Unsupported filter operator: {operator}")

        filtered_df = filtered_df[mask]

    return _records_from_dataframe(filtered_df.reset_index(drop=True))


def _parse_sort(sort_by: str | None) -> tuple[str | None, bool]:
    if not sort_by:
        return None, True

    value = sort_by.strip()
    if not value:
        return None, True

    lower_value = value.lower()
    if lower_value.endswith(" desc"):
        return value[:-5].strip(), False
    if lower_value.endswith(" asc"):
        return value[:-4].strip(), True
    if value.startswith("-"):
        return value[1:].strip(), False
    return value, True


def _apply_window_metric(result_df: pd.DataFrame, metric: dict[str, Any]) -> pd.DataFrame:
    window_name = str(metric.get("window", "")).lower()
    if window_name not in _SUPPORTED_WINDOW_FUNCTIONS:
        raise ValueError(f"Unsupported window function: {window_name}")

    column = metric.get("column")
    if not column:
        raise ValueError("Window metric requires 'column'.")

    partition_by = metric.get("partition_by") or []
    if isinstance(partition_by, str):
        partition_by = [partition_by]

    order_by = metric.get("order_by") or column
    ascending = bool(metric.get("ascending", True))
    alias = metric.get("alias") or f"{window_name}_{column}"

    _require_columns(result_df, partition_by + [order_by, column])

    sort_columns = [*partition_by, order_by]
    sort_flags = [True] * len(partition_by) + [ascending]
    ranked_df = result_df.sort_values(sort_columns, ascending=sort_flags, kind="stable").copy()

    grouped = (
        ranked_df.groupby(partition_by, dropna=False) if partition_by else None
    )

    if window_name == "running_total":
        ranked_df[alias] = (
            grouped[column].cumsum() if grouped is not None else ranked_df[column].cumsum()
        )
    elif window_name == "rank":
        ranked_df[alias] = (
            grouped[column].rank(method="min", ascending=ascending)
            if grouped is not None
            else ranked_df[column].rank(method="min", ascending=ascending)
        )
    elif window_name == "dense_rank":
        ranked_df[alias] = (
            grouped[column].rank(method="dense", ascending=ascending)
            if grouped is not None
            else ranked_df[column].rank(method="dense", ascending=ascending)
        )
    elif window_name == "percent_of_total":
        if grouped is not None:
            denominator = grouped[column].transform("sum")
        else:
            denominator = ranked_df[column].sum()
        ranked_df[alias] = ranked_df[column] / denominator * 100
        ranked_df[alias] = ranked_df[alias].fillna(0)

    return ranked_df


def tool_aggregate(
    dataframe: pd.DataFrame,
    group_by: list[str],
    metrics: list[dict[str, Any]],
    sort_by: str | None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """
    Aggregate rows with groupby + aggregations and optional window functions.

    metric examples:
    {"column": "final_amount", "agg": "sum", "alias": "total_revenue"}
    {"window": "running_total", "column": "total_revenue", "order_by": "month"}
    {"window": "dense_rank", "column": "total_revenue", "order_by": "total_revenue", "ascending": False}
    """
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")

    group_by = group_by or []
    if isinstance(group_by, str):
        group_by = [group_by]
    _require_columns(dataframe, group_by)

    metrics = metrics or []
    agg_metrics = [metric for metric in metrics if "window" not in metric]
    window_metrics = [metric for metric in metrics if "window" in metric]

    if not agg_metrics and not window_metrics:
        raise ValueError("At least one metric is required.")

    if group_by:
        result_df = dataframe.groupby(group_by, dropna=False, as_index=False).size()
        result_df = result_df.drop(columns=["size"])
    else:
        result_df = pd.DataFrame([{}])

    if agg_metrics:
        grouped = dataframe.groupby(group_by, dropna=False) if group_by else None
        for metric in agg_metrics:
            if not isinstance(metric, dict):
                raise ValueError("Each metric must be a dict.")

            column = metric.get("column")
            agg_name = str(metric.get("agg", "sum")).lower()
            alias = metric.get("alias")

            if agg_name not in _SUPPORTED_AGG_FUNCTIONS:
                raise ValueError(f"Unsupported aggregation function: {agg_name}")

            if agg_name == "count" and (column is None or column == "*"):
                alias = alias or "count"
                if group_by:
                    metric_df = (
                        dataframe.groupby(group_by, dropna=False)
                        .size()
                        .reset_index(name=alias)
                    )
                    result_df = result_df.merge(metric_df, on=group_by, how="left")
                else:
                    result_df[alias] = int(len(dataframe))
                continue

            if not column:
                raise ValueError("Aggregation metric requires 'column'.")
            _require_columns(dataframe, [column])
            alias = alias or f"{agg_name}_{column}"

            if group_by:
                metric_df = (
                    grouped[column]
                    .agg(agg_name)
                    .reset_index(name=alias)
                )
                result_df = result_df.merge(metric_df, on=group_by, how="left")
            else:
                result_df[alias] = dataframe[column].agg(agg_name)

    for window_metric in window_metrics:
        result_df = _apply_window_metric(result_df, window_metric)

    sort_column, ascending = _parse_sort(sort_by)
    if sort_column:
        _require_columns(result_df, [sort_column])
        result_df = result_df.sort_values(by=sort_column, ascending=ascending, kind="stable")

    safe_limit = _clamp_limit(limit)
    result_df = result_df.head(safe_limit).reset_index(drop=True)
    return _records_from_dataframe(result_df)


def tool_pivot(
    dataframe: pd.DataFrame,
    index: str,
    columns: str,
    values: str,
    agg: str = "sum",
) -> list[dict[str, Any]]:
    """Create pivot/crosstab table for non-technical friendly summary."""
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")

    agg_name = str(agg).lower()
    if agg_name not in _SUPPORTED_PIVOT_AGG_FUNCTIONS:
        raise ValueError(f"Unsupported pivot aggregation: {agg_name}")

    _require_columns(dataframe, [index, columns, values])

    pivot_df = pd.pivot_table(
        dataframe,
        index=index,
        columns=columns,
        values=values,
        aggfunc=agg_name,
        dropna=False,
        fill_value=0,
    )

    if isinstance(pivot_df.columns, pd.MultiIndex):
        pivot_df.columns = [
            "_".join(str(level) for level in col if level not in (None, ""))
            for col in pivot_df.columns.to_list()
        ]
    else:
        pivot_df.columns = [str(column) for column in pivot_df.columns]

    pivot_df = pivot_df.reset_index()
    return _records_from_dataframe(pivot_df)


def tool_resample_time(
    dataframe: pd.DataFrame,
    date_col: str,
    value_col: str,
    freq: str,
    agg: str = "sum",
) -> list[dict[str, Any]]:
    """Resample time series data by frequency, e.g. month/week/day."""
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")

    agg_name = str(agg).lower()
    if agg_name not in _SUPPORTED_RESAMPLE_AGG_FUNCTIONS:
        raise ValueError(f"Unsupported resample aggregation: {agg_name}")

    _require_columns(dataframe, [date_col, value_col])

    df = dataframe[[date_col, value_col]].copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[date_col, value_col]).sort_values(date_col)

    if df.empty:
        return []

    try:
        result_df = (
            df.set_index(date_col)
            .resample(freq)[value_col]
            .agg(agg_name)
            .reset_index()
        )
    except ValueError as exc:
        raise ValueError(f"Invalid frequency: {freq}") from exc

    result_df = result_df.rename(columns={value_col: f"{agg_name}_{value_col}"})
    return _records_from_dataframe(result_df)


def tool_build_chart_payload(
    records: list[dict[str, Any]],
    x: str,
    y: str,
    series: str | None = None,
    user_question: str | None = None,
    chart_type: str | None = None,
) -> dict[str, Any]:
    """
    Build frontend-ready chart payload from records.

    chart_type input is intentionally ignored. Type is inferred by LLM from the data.
    """
    _ = chart_type

    def _series_meta_from_datasets(datasets: list[dict[str, Any]]) -> list[dict[str, str]]:
        tokens = [
            "brand_primary",
            "brand_secondary",
            "accent_1",
            "accent_2",
            "accent_3",
            "neutral_strong",
        ]
        meta: list[dict[str, str]] = []
        for index, dataset in enumerate(datasets):
            label = str(dataset.get("label", f"Series {index + 1}"))
            meta.append(
                {
                    "key": label,
                    "color_token": tokens[index % len(tokens)],
                }
            )
        return meta

    default_design = _normalize_chart_design({})
    default_title = _default_chart_title(x, y, "table")
    if not records:
        return {
            "title": default_title,
            "chart_type": "table",
            "labels": [],
            "datasets": [],
            "records": [],
            "x_field": x,
            "y_field": y,
            "series_field": series,
            "style_preset": default_design["style_preset"],
            "format": default_design["format"],
            "display": default_design["display"],
            "series_meta": [],
        }

    data = pd.DataFrame(records)
    required_columns = [x, y] + ([series] if series else [])
    _require_columns(data, required_columns)

    data = data.copy()
    data[y] = pd.to_numeric(data[y], errors="coerce")
    data = data.dropna(subset=[y])
    series_field = series
    if series_field:
        series_numeric_ratio = pd.to_numeric(
            data[series_field],
            errors="coerce",
        ).notna().mean()
        if series_numeric_ratio >= 0.8:
            series_field = None

    if data.empty:
        return {
            "title": default_title,
            "chart_type": "table",
            "labels": [],
            "datasets": [],
            "records": [],
            "x_field": x,
            "y_field": y,
            "series_field": series_field,
            "style_preset": default_design["style_preset"],
            "format": default_design["format"],
            "display": default_design["display"],
            "series_meta": [],
        }

    chart_design = _infer_chart_design_with_llm(
        records=_records_from_dataframe(data),
        x=x,
        y=y,
        series=series_field,
        user_question=user_question,
    )

    share_intent = _is_share_intent(user_question)
    chart_kind = chart_design["chart_type"]
    if share_intent:
        chart_kind = "pie"

    inferred_title = str(chart_design.get("title", "")).strip()
    question_title = _compact_user_question_title(user_question)
    if question_title and _is_generic_chart_title(inferred_title):
        chart_title = question_title
    else:
        chart_title = inferred_title or question_title or _default_chart_title(x, y, chart_kind)

    if chart_kind == "table":
        table_records = _records_from_dataframe(data)
        return {
            "title": chart_title,
            "chart_type": "table",
            "labels": [],
            "datasets": [],
            "records": table_records,
            "x_field": x,
            "y_field": y,
            "series_field": series_field,
            "style_preset": chart_design["style_preset"],
            "format": chart_design["format"],
            "display": chart_design["display"],
            "series_meta": [],
        }

    if chart_kind == "scatter":
        if series_field:
            datasets: list[dict[str, Any]] = []
            for series_name, group in data.groupby(series_field, dropna=False):
                points = [
                    {"x": _to_jsonable(row[x]), "y": float(row[y])}
                    for _, row in group.iterrows()
                ]
                datasets.append(
                    {
                        "label": str(series_name),
                        "data": points,
                    }
                )
            chart_records = _records_from_dataframe(data[[x, y, series_field]])
            labels = [str(value) for value in data[x].tolist()]
        else:
            points = [{"x": _to_jsonable(row[x]), "y": float(row[y])} for _, row in data.iterrows()]
            datasets = [{"label": y, "data": points}]
            chart_records = _records_from_dataframe(data[[x, y]])
            labels = [str(value) for value in data[x].tolist()]

        return {
            "title": chart_title,
            "chart_type": "scatter",
            "labels": labels,
            "datasets": datasets,
            "records": chart_records,
            "x_field": x,
            "y_field": y,
            "series_field": series_field,
            "style_preset": chart_design["style_preset"],
            "format": chart_design["format"],
            "display": chart_design["display"],
            "series_meta": _series_meta_from_datasets(datasets),
        }

    if chart_kind == "pie":
        pie_df = data.groupby(x, dropna=False, as_index=False)[y].sum()
        pie_df = _compress_pie_categories(pie_df, x=x, y=y)
        labels = [str(value) for value in pie_df[x].tolist()]
        dataset_values = [float(value) for value in pie_df[y].tolist()]
        return {
            "title": chart_title,
            "chart_type": "pie",
            "labels": labels,
            "datasets": [{"label": y, "data": dataset_values}],
            "records": _records_from_dataframe(pie_df),
            "x_field": x,
            "y_field": y,
            "series_field": series_field,
            "style_preset": chart_design["style_preset"],
            "format": chart_design["format"],
            "display": chart_design["display"],
            "series_meta": [{"key": y, "color_token": "brand_primary"}],
        }

    if series_field:
        chart_df = pd.pivot_table(
            data,
            index=x,
            columns=series_field,
            values=y,
            aggfunc="sum",
            fill_value=0,
            dropna=False,
        ).reset_index()
        labels = [str(value) for value in chart_df[x].tolist()]
        datasets = []
        for column_name in chart_df.columns:
            if column_name == x:
                continue
            datasets.append(
                {
                    "label": str(column_name),
                    "data": [float(value) for value in chart_df[column_name].tolist()],
                }
            )
        chart_records = _records_from_dataframe(chart_df)
    else:
        chart_df = data.groupby(x, dropna=False, as_index=False)[y].sum()
        labels = [str(value) for value in chart_df[x].tolist()]
        datasets = [
            {
                "label": y,
                "data": [float(value) for value in chart_df[y].tolist()],
            }
        ]
        chart_records = _records_from_dataframe(chart_df)

    return {
        "title": chart_title,
        "chart_type": chart_kind,
        "labels": labels,
        "datasets": datasets,
        "records": chart_records,
        "x_field": x,
        "y_field": y,
        "series_field": series_field,
        "style_preset": chart_design["style_preset"],
        "format": chart_design["format"],
        "display": chart_design["display"],
        "series_meta": _series_meta_from_datasets(datasets),
    }


def build_pandas_tools(dataframe: pd.DataFrame) -> list[StructuredTool]:
    """
    Build tool objects that bind a specific DataFrame for the pandas agent.

    This is the first function from the previous list: it assembles and returns
    the tools that the LLM can call.
    """
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")

    def get_schema_tool() -> dict[str, Any]:
        return tool_get_schema(dataframe)

    def preview_rows_tool(limit: int = 10) -> list[dict[str, Any]]:
        return tool_preview_rows(dataframe, limit=limit)

    def filter_rows_tool(filters: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return tool_filter_rows(dataframe, filters=filters)

    def aggregate_rows_tool(
        group_by: list[str],
        metrics: list[dict[str, Any]],
        sort_by: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        return tool_aggregate(
            dataframe,
            group_by=group_by,
            metrics=metrics,
            sort_by=sort_by,
            limit=limit,
        )

    def pivot_rows_tool(index: str, columns: str, values: str, agg: str = "sum") -> list[dict[str, Any]]:
        return tool_pivot(
            dataframe,
            index=index,
            columns=columns,
            values=values,
            agg=agg,
        )

    def resample_time_tool(
        date_col: str,
        value_col: str,
        freq: str,
        agg: str = "sum",
    ) -> list[dict[str, Any]]:
        return tool_resample_time(
            dataframe,
            date_col=date_col,
            value_col=value_col,
            freq=freq,
            agg=agg,
        )

    def build_chart_payload_tool(
        records: list[dict[str, Any]],
        x: str,
        y: str,
        series: str | None = None,
        user_question: str | None = None,
        chart_type: str | None = None,
    ) -> dict[str, Any]:
        return tool_build_chart_payload(
            records=records,
            x=x,
            y=y,
            series=series,
            user_question=user_question,
            chart_type=chart_type,
        )

    return [
        StructuredTool.from_function(
            func=get_schema_tool,
            name="get_dataframe_schema",
            description="Get DataFrame schema: columns, dtypes, null counts, and row count.",
        ),
        StructuredTool.from_function(
            func=preview_rows_tool,
            name="preview_dataframe_rows",
            description="Preview first N rows from DataFrame as JSON-safe records.",
        ),
        StructuredTool.from_function(
            func=filter_rows_tool,
            name="filter_dataframe_rows",
            description="Filter rows. Input filters as list of dict: [{column, op, value}] where op in =, !=, >, >=, <, <=, in, contains.",
        ),
        StructuredTool.from_function(
            func=aggregate_rows_tool,
            name="aggregate_dataframe_rows",
            description="Aggregate rows with group_by + metrics. Metrics support agg(sum,mean,count,min,max,median,nunique) and window(running_total,rank,dense_rank,percent_of_total).",
        ),
        StructuredTool.from_function(
            func=pivot_rows_tool,
            name="pivot_dataframe_rows",
            description="Create pivot table for summary. Input: index, columns, values, agg(sum,mean,count,min,max,median).",
        ),
        StructuredTool.from_function(
            func=resample_time_tool,
            name="resample_dataframe_time",
            description="Resample by time frequency. Input: date_col, value_col, freq (e.g. D/W/M/MS), agg(sum,mean,count,min,max,median).",
        ),
        StructuredTool.from_function(
            func=build_chart_payload_tool,
            name="build_chart_payload",
            description="Build frontend chart payload from records: {chart_type, labels, datasets, records, style_preset, format, display, series_meta}. Include user_question for better intent-aware chart inference. chart_type/style are inferred by LLM from data.",
        ),
    ]


def create_pandas_agent_executor(dataframe: pd.DataFrame):
    """
    Build a LangChain pandas dataframe agent executor from a DataFrame.

    The returned executor can be called with:
    executor.invoke({"input": "your aggregation question"})
    """
    if not isinstance(dataframe, pd.DataFrame):
        raise TypeError("dataframe must be a pandas.DataFrame")
    if dataframe.empty:
        raise ValueError("dataframe is empty")

    logger.info("Initializing LangChain Pandas DataFrame Agent...")
    llm = get_chat_llm()

    signature = inspect.signature(create_pandas_dataframe_agent)
    kwargs: dict[str, Any] = {
        "llm": llm,
        "df": dataframe,
        "verbose": True,
    }

    if "prefix" in signature.parameters:
        kwargs["prefix"] = SYSTEM_PROMPT
    if "max_iterations" in signature.parameters:
        kwargs["max_iterations"] = 8
    if "agent_executor_kwargs" in signature.parameters:
        kwargs["agent_executor_kwargs"] = {
            "handle_parsing_errors": True,
            "return_intermediate_steps": True,
        }
    if "agent_type" in signature.parameters:
        kwargs["agent_type"] = "tool-calling"
    if "allow_dangerous_code" in signature.parameters:
        kwargs["allow_dangerous_code"] = True
    if "extra_tools" in signature.parameters:
        kwargs["extra_tools"] = build_pandas_tools(dataframe)

    return create_pandas_dataframe_agent(**kwargs)


def get_pandas_agent_executor(dataframe: pd.DataFrame):
    global _pandas_agent, _pandas_agent_df_id
    dataframe_id = id(dataframe)
    if _pandas_agent is None or _pandas_agent_df_id != dataframe_id:
        _pandas_agent = create_pandas_agent_executor(dataframe)
        _pandas_agent_df_id = dataframe_id
    return _pandas_agent
