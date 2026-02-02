from fastapi import APIRouter, HTTPException

from app.db.postgres import DataBasePool
from app.schemas.appointment import (
    AppointmentCreateRequest,
    AppointmentListResponse,
    AppointmentRow,
    AppointmentStatusUpdate,
)

router = APIRouter(prefix="/appointment", tags=["appointment"])


@router.get("", response_model=AppointmentListResponse)
async def list_appointments() -> AppointmentListResponse:
    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        rows = await connection.fetch(
            """
            SELECT
              a.appointment_id,
              a.customer_id,
              c.customer_code,
              c.full_name,
              a.appointment_time,
              a.appointment_status
            FROM appointment a
            LEFT JOIN customer c ON c.customer_id = a.customer_id
            ORDER BY a.appointment_time DESC NULLS LAST, a.appointment_id DESC
            """
        )

    return AppointmentListResponse(
        items=[AppointmentRow(**dict(row)) for row in rows]
    )


@router.patch("/{appointment_id}", response_model=AppointmentRow)
async def update_appointment_status(
    appointment_id: int, payload: AppointmentStatusUpdate
) -> AppointmentRow:
    status = (payload.appointment_status or "").upper()
    if status not in {"COMPLETE", "INCOMPLETE"}:
        raise HTTPException(status_code=400, detail="Invalid appointment_status")

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            """
            UPDATE appointment
            SET appointment_status = $2
            WHERE appointment_id = $1
            RETURNING appointment_id, customer_id, appointment_time, appointment_status
            """,
            appointment_id,
            status,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Appointment not found")

        customer = await connection.fetchrow(
            """
            SELECT customer_code, full_name
            FROM customer
            WHERE customer_id = $1
            """,
            row["customer_id"],
        )

    data = dict(row)
    if customer:
        data["customer_code"] = customer["customer_code"]
        data["full_name"] = customer["full_name"]
    return AppointmentRow(**data)


@router.post("", response_model=AppointmentRow)
async def create_appointment(payload: AppointmentCreateRequest) -> AppointmentRow:

    status = (payload.appointment_status or "INCOMPLETE").upper()
    if status not in {"COMPLETE", "INCOMPLETE"}:
        raise HTTPException(status_code=400, detail="Invalid appointment_status")

    pool = await DataBasePool.get_pool()
    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            """
            INSERT INTO appointment (customer_id, appointment_time, appointment_status)
            VALUES ($1, $2, $3)
            RETURNING appointment_id, customer_id, appointment_time, appointment_status
            """,
            payload.customer_id,
            payload.appointment_time,
            status,
        )
        customer = await connection.fetchrow(
            """
            SELECT customer_code, full_name
            FROM customer
            WHERE customer_id = $1
            """,
            row["customer_id"],
        )

    data = dict(row)
    if customer:
        data["customer_code"] = customer["customer_code"]
        data["full_name"] = customer["full_name"]
    return AppointmentRow(**data)
