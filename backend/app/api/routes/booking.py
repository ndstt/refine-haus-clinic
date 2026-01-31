from datetime import datetime

from fastapi import APIRouter

from app.db.postgres import DataBasePool
from app.schemas.booking import BookingRequest, BookingResponse

router = APIRouter(prefix="/booking", tags=["booking"])


@router.post("", response_model=BookingResponse)
async def create_booking(request: BookingRequest) -> BookingResponse:
    """
    Create a new booking and save to database.
    Supports multiple treatments in a single booking.
    Inserts into sell_invoice, sell_invoice_item, and treatment_session tables.
    """
    pool = await DataBasePool.get_pool()

    try:
        async with pool.acquire() as connection:
            async with connection.transaction():
                # 1. Find or create customer
                customer_id = None
                if request.customer_id:
                    # Try to find existing customer by customer_code
                    customer = await connection.fetchrow(
                        "SELECT customer_id FROM customer WHERE customer_code = $1",
                        request.customer_id,
                    )
                    if customer:
                        customer_id = customer["customer_id"]

                # If no customer found, create a new one
                if not customer_id:
                    customer_id = await connection.fetchval(
                        """
                        INSERT INTO customer (full_name, member_wallet_remain)
                        VALUES ($1, 0)
                        RETURNING customer_id
                        """,
                        request.customer_name,
                    )

                # 2. Create sell_invoice
                sell_invoice_id = await connection.fetchval(
                    """
                    INSERT INTO sell_invoice (customer_id, issue_at, total_amount, discount_amount, final_amount, status)
                    VALUES ($1, $2, $3, 0, $3, 'PAID')
                    RETURNING sell_invoice_id
                    """,
                    customer_id,
                    datetime.now(),
                    request.total_amount,
                )

                # 3. Get invoice_no
                invoice_no = await connection.fetchval(
                    "SELECT invoice_no FROM sell_invoice WHERE sell_invoice_id = $1",
                    sell_invoice_id,
                )

                # 4. Parse session date
                try:
                    session_date = datetime.strptime(request.session_date, "%Y-%m-%d").date()
                except ValueError:
                    session_date = datetime.now().date()

                # 5. Create sell_invoice_item and treatment_session for each treatment
                for treatment in request.treatments:
                    item_total = treatment.price * treatment.quantity

                    # Insert into sell_invoice_item
                    await connection.execute(
                        """
                        INSERT INTO sell_invoice_item (item_id, sell_invoice_id, description, qty, total_price)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        treatment.treatment_id,
                        sell_invoice_id,
                        None,
                        treatment.quantity,
                        item_total,
                    )

                    # Insert into treatment_session
                    await connection.execute(
                        """
                        INSERT INTO treatment_session (treatment_id, sell_invoice_id, customer_id, session_date, note)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        treatment.treatment_id,
                        sell_invoice_id,
                        customer_id,
                        session_date,
                        request.note,
                    )

        return BookingResponse(
            success=True,
            invoice_no=invoice_no,
            sell_invoice_id=sell_invoice_id,
        )

    except Exception as e:
        return BookingResponse(
            success=False,
            message=str(e),
        )
