import ast
import json
import logging
import re
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.agents.prompts.pandas_agent import (
    _PANDAS_CHART_PROMPT,
    _VISUALIZE_SQL_HINT,
)
from app.agents.pandas_agent import (
    get_pandas_agent_executor,
    tool_build_chart_payload,
)
from app.agents.sql_agent import get_sql_agent_executor
from app.db.postgres import DataBasePool
from app.schemas.chat import ChatRequest, SqlChatResponse

router = APIRouter(prefix="/ai", tags=["ai"])

logger = logging.getLogger(__name__)
_messages_payload_json_supported: bool | None = None

_DISALLOWED_SQL = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do|execute)\b",
    flags=re.IGNORECASE,
)


def _title_from_message(message: str) -> str:
    cleaned = " ".join(message.strip().split())
    if len(cleaned) <= 60:
        return cleaned
    return f"{cleaned[:57]}..."


def _is_thai_text(text: str | None) -> bool:
    return bool(re.search(r"[\u0E00-\u0E7F]", text or ""))


def _is_share_query(text: str | None) -> bool:
    if not text:
        return False
    normalized = text.lower()
    keywords = (
        "share",
        "proportion",
        "distribution",
        "composition",
        "breakdown",
        "สัดส่วน",
        "กระจาย",
        "แบ่งตาม",
    )
    return any(keyword in normalized for keyword in keywords)


def _language_response_hint(message: str) -> str:
    if _is_thai_text(message):
        return (
            "Language requirement:\n"
            "- The user asked in Thai.\n"
            "- Reply in Thai only (except proper nouns and SQL keywords)."
        )
    return (
        "Language requirement:\n"
        "- The user asked in English.\n"
        "- Reply in English only."
    )


def _default_failure_response(message: str) -> str:
    if _is_thai_text(message):
        return "ไม่สามารถประมวลผลคำขอได้ กรุณาลองใหม่อีกครั้ง"
    return "Unable to process your request. Please try again."


def _extract_sql_query(intermediate_steps, output_text: str | None = None) -> str | None:
    query_candidates: list[str] = []
    for step in intermediate_steps or []:
        if len(step) < 2:
            continue
        action = step[0]
        tool_input = getattr(action, "tool_input", None)
        if isinstance(tool_input, dict) and "query" in tool_input:
            query_value = tool_input.get("query")
            if isinstance(query_value, str):
                query_candidates.append(query_value)
        if isinstance(tool_input, str) and "SELECT" in tool_input.upper():
            query_candidates.append(tool_input)

    if query_candidates:
        return query_candidates[-1]

    if not output_text:
        return None

    # Fallback: parse SQL from fenced blocks or plain text output.
    fenced_match = re.search(
        r"```(?:sql)?\s*(with[\s\S]+?|select[\s\S]+?)```",
        output_text,
        flags=re.IGNORECASE,
    )
    if fenced_match:
        return fenced_match.group(1).strip()

    plain_match = re.search(
        r"\b(with|select)\b[\s\S]+",
        output_text,
        flags=re.IGNORECASE,
    )
    if plain_match:
        candidate = plain_match.group(0).strip()
        semicolon_index = candidate.find(";")
        if semicolon_index != -1:
            candidate = candidate[: semicolon_index + 1].strip()
        if "\n\n" in candidate:
            candidate = candidate.split("\n\n", 1)[0].strip()
        return candidate

    return None


def _sanitize_select_query(query: str | None) -> str | None:
    if not query:
        return None

    cleaned = query.strip()
    if cleaned.endswith(";"):
        cleaned = cleaned[:-1].strip()
    if not cleaned:
        return None

    lowered = cleaned.lower()
    if ";" in lowered:
        return None
    if "--" in lowered or "/*" in lowered or "*/" in lowered:
        return None
    if not (lowered.startswith("select") or lowered.startswith("with")):
        return None
    if _DISALLOWED_SQL.search(lowered):
        return None

    return cleaned


def _pick_chart_axes(dataframe: pd.DataFrame) -> tuple[str, str, str | None]:
    columns = list(dataframe.columns)
    if len(columns) < 2:
        raise ValueError("Need at least two columns to build chart payload")

    if "x" in dataframe.columns and "y" in dataframe.columns:
        return "x", "y", "series" if "series" in dataframe.columns else None

    numeric_columns = [
        column
        for column in columns
        if pd.to_numeric(dataframe[column], errors="coerce").notna().any()
    ]

    y_column = numeric_columns[0] if numeric_columns else columns[1]
    x_column = next((column for column in columns if column != y_column), columns[0])
    series_candidates = [column for column in columns if column not in {x_column, y_column}]
    series_column: str | None = None
    for candidate in series_candidates:
        numeric_ratio = pd.to_numeric(dataframe[candidate], errors="coerce").notna().mean()
        if numeric_ratio < 0.8:
            series_column = candidate
            break

    return x_column, y_column, series_column


def _build_chart_payload_from_rows(
    rows: list[dict[str, Any]],
    user_question: str | None = None,
) -> dict[str, Any] | None:
    if not rows:
        return None

    dataframe = pd.DataFrame(rows)
    if dataframe.empty:
        return None

    x_column, y_column, series_column = _pick_chart_axes(dataframe)
    return tool_build_chart_payload(
        records=rows,
        x=x_column,
        y=y_column,
        series=series_column,
        user_question=user_question,
    )

def _coerce_json_object(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", errors="ignore")
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    candidates = [text]
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        candidates.append(text[start : end + 1])

    for candidate in candidates:
        for parser in (json.loads, ast.literal_eval):
            try:
                parsed = parser(candidate)
            except Exception:
                continue
            if isinstance(parsed, dict):
                return parsed
    return None


def _extract_chart_payload_from_pandas_result(result: dict[str, Any]) -> dict[str, Any] | None:
    for step in reversed(result.get("intermediate_steps") or []):
        if len(step) < 2:
            continue
        action, observation = step[0], step[1]
        if getattr(action, "tool", None) != "build_chart_payload":
            continue
        payload = _coerce_json_object(observation)
        if payload and "chart_type" in payload and "records" in payload:
            return payload

    output_payload = _coerce_json_object(result.get("output"))
    if output_payload and "chart_type" in output_payload and "records" in output_payload:
        return output_payload
    return None


def _build_chart_payload_with_pandas_agent(
    rows: list[dict[str, Any]],
    user_question: str,
    sql_query: str,
) -> dict[str, Any] | None:
    if not rows:
        return None

    dataframe = pd.DataFrame(rows)
    if dataframe.empty:
        return None

    columns = ", ".join(f"{column}:{dtype}" for column, dtype in dataframe.dtypes.items())
    prompt = _PANDAS_CHART_PROMPT.format(
        user_question=user_question,
        sql_query=sql_query,
        columns=columns,
    )

    try:
        pandas_agent = get_pandas_agent_executor(dataframe)
        result = pandas_agent.invoke({"input": prompt})
        payload = _extract_chart_payload_from_pandas_result(result)
        if payload is not None:
            if _is_share_query(user_question) and str(payload.get("chart_type", "")).lower() != "pie":
                logger.info("Share query returned non-pie payload, rebuilding as pie-compatible payload.")
                return _build_chart_payload_from_rows(rows, user_question=user_question)
            return payload
        logger.warning("Pandas agent did not return chart payload. Using fallback builder.")
    except Exception as exc:
        logger.warning("Pandas agent chart build failed: %s. Using fallback builder.", exc)

    return _build_chart_payload_from_rows(rows, user_question=user_question)


def _build_visualize_user_response(
    chart_payload: dict[str, Any] | None,
    sql_query: str | None,
    user_message: str,
    viz_status: str | None = None,
) -> str:
    is_thai = _is_thai_text(user_message)
    if chart_payload:
        chart_type = str(chart_payload.get("chart_type", "chart"))
        if is_thai:
            return f"เตรียมข้อมูลสำหรับ visualization เรียบร้อยแล้ว ({chart_type})"
        return f"Visualization ready ({chart_type})."
    if viz_status == "no_rows":
        if is_thai:
            return "สร้าง SQL ได้แล้ว แต่ไม่พบข้อมูลสำหรับช่วงเวลานี้ จึงยังสร้างกราฟไม่ได้"
        return "SQL was generated, but no data matched this period, so no chart was created."
    if viz_status == "unsafe_sql":
        if is_thai:
            return "SQL ที่ได้ไม่ผ่านเงื่อนไขความปลอดภัยสำหรับ visualization"
        return "Generated SQL did not pass visualization safety checks."
    if viz_status == "query_error":
        if is_thai:
            return "รัน SQL สำหรับ visualization ไม่สำเร็จ"
        return "Failed to execute SQL for visualization."
    if viz_status == "payload_failed":
        if is_thai:
            return "ได้ข้อมูลแล้ว แต่แปลงเป็น chart payload ไม่สำเร็จ"
        return "Data was fetched, but chart payload generation failed."
    if viz_status == "no_sql":
        if is_thai:
            return "ไม่พบ SQL ที่ใช้ทำ visualization จากคำตอบของเอเจนต์"
        return "No visualization SQL could be extracted from the agent output."
    if sql_query:
        if is_thai:
            return "สร้าง SQL สำหรับ visualization ได้แล้ว แต่ยังแปลงเป็น chart payload ไม่สำเร็จ"
        return "Generated SQL for visualization, but chart payload could not be prepared."
    if is_thai:
        return "ไม่สามารถเตรียมข้อมูล visualization จากคำถามนี้ได้"
    return "Unable to prepare visualization for this request."


def _append_visualization_notice(base_response: str, notice: str) -> str:
    cleaned_response = (base_response or "").strip()
    cleaned_notice = (notice or "").strip()
    if not cleaned_notice:
        return cleaned_response
    if not cleaned_response:
        return cleaned_notice
    return f"{cleaned_response}\n\n{cleaned_notice}"


def _strip_sql_from_response(text: str) -> str:
    if not text:
        return text

    cleaned = re.sub(r"```sql[\s\S]*?```", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"for visualization[^\n]*sql query[^\n]*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"this query will provide[^\n]*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = "\n".join(
        line for line in cleaned.splitlines() if "sql" not in line.lower()
    )
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned or text.strip()


async def _messages_support_payload_json(connection) -> bool:
    global _messages_payload_json_supported
    if _messages_payload_json_supported is not None:
        return _messages_payload_json_supported

    exists = await connection.fetchval(
        """
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'messages'
            AND column_name = 'payload_json'
        )
        """
    )
    _messages_payload_json_supported = bool(exists)
    return _messages_payload_json_supported


async def _insert_message(
    connection,
    conversation_id: int,
    role: str,
    content: str,
    payload_json: dict[str, Any] | None = None,
) -> None:
    supports_payload_json = await _messages_support_payload_json(connection)
    if supports_payload_json:
        payload_value = json.dumps(payload_json) if payload_json is not None else None
        await connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content, payload_json)
            VALUES ($1, $2::chat_role, $3, $4::jsonb)
            """,
            conversation_id,
            role,
            content,
            payload_value,
        )
        return

    await connection.execute(
        """
        INSERT INTO messages (conversation_id, role, content)
        VALUES ($1, $2::chat_role, $3)
        """,
        conversation_id,
        role,
        content,
    )
    if payload_json is not None:
        logger.warning(
            "payload_json was provided but messages.payload_json column is missing. "
            "Run schema migration before storing payload data."
        )


@router.post("/chat", response_model=SqlChatResponse)
async def sql_chat(payload: ChatRequest) -> SqlChatResponse:
    pool = await DataBasePool.get_pool()
    default_failure_response = _default_failure_response(payload.message)
    response = default_failure_response
    sql_query: str | None = None
    chart_payload: dict[str, Any] | None = None
    viz_status: str | None = None

    async with pool.acquire() as connection:
        if payload.conversation_id is None:
            row = await connection.fetchrow(
                "INSERT INTO conversations (title) VALUES (NULL) RETURNING conversation_id"
            )
            if row is None:
                raise HTTPException(status_code=500, detail="Failed to create conversation")
            conversation_id = row["conversation_id"]
        else:
            conversation_id = payload.conversation_id

        await _insert_message(
            connection=connection,
            conversation_id=conversation_id,
            role="USER",
            content=payload.message,
        )

        title = _title_from_message(payload.message)
        await connection.execute(
            """
            UPDATE conversations
            SET title = COALESCE(title, $2), updated_at = now()
            WHERE conversation_id = $1
            """,
            conversation_id,
            title,
        )

    try:
        sql_agent = get_sql_agent_executor()
        agent_input = payload.message + "\n\n" + _language_response_hint(payload.message)
        if payload.visualize:
            agent_input = agent_input + "\n\n" + _VISUALIZE_SQL_HINT
        result = sql_agent.invoke({"input": agent_input})
        response = result.get("output", default_failure_response)
        sql_query = _extract_sql_query(
            result.get("intermediate_steps"),
            output_text=response,
        )

    except Exception as exc:
        logger.error("SQL Agent error: %s", exc)
        response = default_failure_response
        sql_query = None
        chart_payload = None
        if payload.visualize:
            viz_status = "no_sql"

    if payload.visualize and sql_query:
        safe_query = _sanitize_select_query(sql_query)
        if safe_query:
            try:
                async with pool.acquire() as connection:
                    rows = await connection.fetch(safe_query)
                row_dicts = [dict(row) for row in rows]
                if not row_dicts:
                    viz_status = "no_rows"
                else:
                    chart_payload = _build_chart_payload_with_pandas_agent(
                        rows=row_dicts,
                        user_question=payload.message,
                        sql_query=safe_query,
                    )
                    if chart_payload is None:
                        viz_status = "payload_failed"
                    else:
                        viz_status = "ok"
            except Exception as exc:
                logger.warning("Visualization query execution failed: %s", exc)
                chart_payload = None
                viz_status = "query_error"
        else:
            logger.warning("Visualization mode produced unsafe SQL. Chart payload skipped.")
            viz_status = "unsafe_sql"
    elif payload.visualize and not sql_query:
        viz_status = "no_sql"

    if payload.visualize and chart_payload:
        response = _strip_sql_from_response(response)

    if payload.visualize and not chart_payload:
        response = _append_visualization_notice(
            response,
            _build_visualize_user_response(
                chart_payload,
                sql_query,
                payload.message,
                viz_status=viz_status,
            ),
        )

    async with pool.acquire() as connection:
        fallback_payload = None
        if chart_payload:
            fallback_payload = chart_payload
        elif sql_query or viz_status:
            fallback_payload = {
                "sql_query": sql_query,
                "viz_status": viz_status,
            }
        await _insert_message(
            connection=connection,
            conversation_id=conversation_id,
            role="SYSTEM",
            content=response,
            payload_json=fallback_payload,
        )

    return SqlChatResponse(
        response=response,
        conversation_id=conversation_id,
        sql_query=sql_query,
    )
