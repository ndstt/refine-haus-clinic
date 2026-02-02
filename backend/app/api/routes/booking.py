from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter

from app.db.postgres import DataBasePool
from app.schemas.booking import BookingRequest, BookingResponse

router = APIRouter(prefix="/booking", tags=["booking"])

def _compare_numeric(lhs: Decimal | None, op: str, rhs: Decimal | None) -> bool:
    if lhs is None or rhs is None:
        return False
    if op == "EQ":
        return lhs == rhs
    if op == "GTE":
        return lhs >= rhs
    if op == "LTE":
        return lhs <= rhs
    return False


async def _promotion_rules_satisfied(
    connection,
    promotion_id: int,
    sell_invoice_id: int,
    customer_id: int,
) -> bool:
    group_count = await connection.fetchval(
        """
        SELECT COUNT(*)
        FROM promotion_condition_group
        WHERE promotion_id = $1
        """,
        promotion_id,
    )
    if not group_count:
        return True

    invoice_total = await connection.fetchval(
        """
        SELECT COALESCE(SUM(total_price), 0)
        FROM sell_invoice_item
        WHERE sell_invoice_id = $1
        """,
        sell_invoice_id,
    )
    invoice_total = Decimal(invoice_total or 0)

    groups = await connection.fetch(
        """
        SELECT condition_group_id
        FROM promotion_condition_group
        WHERE promotion_id = $1
        ORDER BY sort_order
        """,
        promotion_id,
    )

    for group in groups:
        group_ok = True
        rules = await connection.fetch(
            """
            SELECT rule_type, op, amount_value, item_id, qty_base_unit
            FROM promotion_condition_rule
            WHERE condition_group_id = $1
            """,
            group["condition_group_id"],
        )

        for rule in rules:
            rule_ok = False
            rule_type = rule["rule_type"]

            if rule_type == "MIN_SPEND":
                rule_ok = _compare_numeric(
                    invoice_total, rule["op"], Decimal(rule["amount_value"] or 0)
                )
            elif rule_type == "HAS_ITEM":
                if rule["item_id"] is None:
                    rule_ok = False
                else:
                    has_item = await connection.fetchval(
                        """
                        SELECT EXISTS (
                          SELECT 1
                          FROM sell_invoice_item
                          WHERE sell_invoice_id = $1
                            AND item_id = $2
                        )
                        """,
                        sell_invoice_id,
                        rule["item_id"],
                    )
                    rule_ok = bool(has_item)
            elif rule_type == "MIN_QTY_ITEM":
                if rule["item_id"] is None:
                    rule_ok = False
                else:
                    item_qty = await connection.fetchval(
                        """
                        SELECT COALESCE(SUM(qty), 0)
                        FROM sell_invoice_item
                        WHERE sell_invoice_id = $1
                          AND item_id = $2
                        """,
                        sell_invoice_id,
                        rule["item_id"],
                    )
                    rule_ok = _compare_numeric(
                        Decimal(item_qty or 0),
                        rule["op"],
                        Decimal(rule["qty_base_unit"] or 0),
                    )
            elif rule_type == "NEW_CUSTOMER_ONLY":
                prior_invoices = await connection.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM sell_invoice
                    WHERE customer_id = $1
                      AND sell_invoice_id <> $2
                    """,
                    customer_id,
                    sell_invoice_id,
                )
                rule_ok = (prior_invoices or 0) == 0
            elif rule_type == "MIN_WALLET_TOPUP":
                wallet_topup = await connection.fetchval(
                    """
                    SELECT COALESCE(SUM(amount), 0)
                    FROM wallet_movement
                    WHERE customer_id = $1
                      AND amount > 0
                    """,
                    customer_id,
                )
                rule_ok = _compare_numeric(
                    Decimal(wallet_topup or 0),
                    rule["op"],
                    Decimal(rule["amount_value"] or 0),
                )

            if not rule_ok:
                group_ok = False
                break

        if group_ok:
            return True

    return False


async def _apply_promotion_benefits(
    connection,
    promotion_id: int,
    sell_invoice_id: int,
    promotion_redemption_id: int,
):
    invoice_total = await connection.fetchval(
        """
        SELECT COALESCE(SUM(total_price), 0)
        FROM sell_invoice_item
        WHERE sell_invoice_id = $1
        """,
        sell_invoice_id,
    )
    invoice_total = Decimal(invoice_total or 0)

    benefits = await connection.fetch(
        """
        SELECT promotion_benefit_id, benefit_type, target_scope, target_item_id,
               value_percent, value_amount, free_item_id, free_qty_base_unit
        FROM promotion_benefit
        WHERE promotion_id = $1
        """,
        promotion_id,
    )

    for benefit in benefits:
        target_total = invoice_total
        if benefit["target_scope"] != "INVOICE_TOTAL":
            target_total = await connection.fetchval(
                """
                SELECT COALESCE(SUM(total_price), 0)
                FROM sell_invoice_item
                WHERE sell_invoice_id = $1
                  AND item_id = $2
                """,
                sell_invoice_id,
                benefit["target_item_id"],
            )
            target_total = Decimal(target_total or 0)

        benefit_type = benefit["benefit_type"]
        if benefit_type == "PERCENT_DISCOUNT":
            if not benefit["value_percent"] or target_total <= 0:
                continue
            discount_amount = (target_total * Decimal(benefit["value_percent"]) / 100).quantize(Decimal("0.01"))
            if discount_amount > 0:
                await connection.execute(
                    """
                    INSERT INTO sell_invoice_promotion_line (
                      sell_invoice_id,
                      promotion_redemption_id,
                      promotion_id,
                      promotion_benefit_id,
                      line_type,
                      amount,
                      created_at
                    )
                    VALUES ($1, $2, $3, $4, 'DISCOUNT', $5, now())
                    """,
                    sell_invoice_id,
                    promotion_redemption_id,
                    promotion_id,
                    benefit["promotion_benefit_id"],
                    -discount_amount,
                )
        elif benefit_type == "AMOUNT_DISCOUNT":
            if not benefit["value_amount"] or target_total <= 0:
                continue
            discount_amount = min(Decimal(benefit["value_amount"]), target_total)
            if discount_amount > 0:
                await connection.execute(
                    """
                    INSERT INTO sell_invoice_promotion_line (
                      sell_invoice_id,
                      promotion_redemption_id,
                      promotion_id,
                      promotion_benefit_id,
                      line_type,
                      amount,
                      created_at
                    )
                    VALUES ($1, $2, $3, $4, 'DISCOUNT', $5, now())
                    """,
                    sell_invoice_id,
                    promotion_redemption_id,
                    promotion_id,
                    benefit["promotion_benefit_id"],
                    -discount_amount,
                )
        elif benefit_type == "FREE_ITEM":
            free_item_id = benefit["free_item_id"] or benefit["target_item_id"]
            free_qty = Decimal(benefit["free_qty_base_unit"] or 0)
            if not free_item_id or free_qty <= 0:
                continue
            await connection.execute(
                """
                INSERT INTO sell_invoice_promotion_line (
                  sell_invoice_id,
                  promotion_redemption_id,
                  promotion_id,
                  promotion_benefit_id,
                  line_type,
                  amount,
                  free_item_id,
                  free_qty_base_unit,
                  created_at
                )
                VALUES ($1, $2, $3, $4, 'FREE_ITEM', 0, $5, $6, now())
                """,
                sell_invoice_id,
                promotion_redemption_id,
                promotion_id,
                benefit["promotion_benefit_id"],
                free_item_id,
                free_qty,
            )
            await connection.execute(
                """
                INSERT INTO stock_movement (
                  created_at,
                  item_id,
                  movement_type,
                  qty,
                  sell_invoice_id,
                  purchase_invoice_id
                )
                VALUES (now(), $1, 'USE_FOR_PROMOTION', $2, $3, NULL)
                """,
                free_item_id,
                -free_qty,
                sell_invoice_id,
            )
        elif benefit_type == "WALLET_CREDIT":
            if benefit["value_amount"] is not None:
                credit_amount = Decimal(benefit["value_amount"])
            elif benefit["value_percent"] is not None:
                credit_amount = (target_total * Decimal(benefit["value_percent"]) / 100).quantize(Decimal("0.01"))
            else:
                continue
            if credit_amount <= 0:
                continue
            await connection.execute(
                """
                INSERT INTO sell_invoice_promotion_line (
                  sell_invoice_id,
                  promotion_redemption_id,
                  promotion_id,
                  promotion_benefit_id,
                  line_type,
                  amount,
                  wallet_credit_amount,
                  created_at
                )
                VALUES ($1, $2, $3, $4, 'WALLET_CREDIT', 0, $5, now())
                """,
                sell_invoice_id,
                promotion_redemption_id,
                promotion_id,
                benefit["promotion_benefit_id"],
                credit_amount,
            )



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

                # 4. Parse session date/time
                try:
                    session_date = datetime.strptime(request.session_date, "%Y-%m-%d").date()
                except ValueError:
                    session_date = datetime.now().date()

                try:
                    session_time = datetime.strptime(request.session_time, "%H:%M").time()
                except ValueError:
                    session_time = datetime.now().time().replace(second=0, microsecond=0)

                # 5. Create sell_invoice_item and treatment_session for each treatment
                for treatment in request.treatments:
                    item_total = treatment.price * treatment.quantity
                    qty_per_session = await connection.fetchval(
                        """
                        SELECT qty_per_session
                        FROM treatment_recipe
                        WHERE treatment_id = $1
                        LIMIT 1
                        """,
                        treatment.treatment_id,
                    )
                    qty_per_session = 1 if qty_per_session is None else qty_per_session
                    line_qty = int(treatment.quantity * qty_per_session)

                    # Insert into sell_invoice_item
                    await connection.execute(
                        """
                        INSERT INTO sell_invoice_item (item_id, sell_invoice_id, description, qty, total_price)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        treatment.treatment_id,
                        sell_invoice_id,
                        None,
                        line_qty,
                        item_total,
                    )

                    # Insert into treatment_session
                    await connection.execute(
                        """
                        INSERT INTO treatment_session (
                          treatment_id,
                          sell_invoice_id,
                          customer_id,
                          session_date,
                          session_time,
                          note
                        )
                        VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        treatment.treatment_id,
                        sell_invoice_id,
                        customer_id,
                        session_date,
                        session_time,
                        request.note,
                    )

                # 6. Apply promotions (create promotion_redemption + promo lines)
                promotion_ids = list({int(pid) for pid in (request.promotions or [])})
                for promotion_id in promotion_ids:
                    is_stackable = await connection.fetchval(
                        "SELECT is_stackable FROM promotion WHERE promotion_id = $1",
                        promotion_id,
                    )
                    if is_stackable is False:
                        conflict = await connection.fetchval(
                            """
                            SELECT EXISTS (
                              SELECT 1
                              FROM sell_invoice_promotion_line sip
                              JOIN promotion p ON p.promotion_id = sip.promotion_id
                              WHERE sip.sell_invoice_id = $1
                                AND p.is_stackable = false
                                AND sip.promotion_id <> $2
                            )
                            """,
                            sell_invoice_id,
                            promotion_id,
                        )
                        if conflict:
                            continue

                    if not await _promotion_rules_satisfied(
                        connection, promotion_id, sell_invoice_id, customer_id
                    ):
                        continue

                    promotion_redemption_id = await connection.fetchval(
                        """
                        INSERT INTO promotion_redemption (
                          promotion_id,
                          sell_invoice_id,
                          customer_id,
                          coupon_code_used
                        )
                        VALUES ($1, $2, $3, NULL)
                        RETURNING promotion_redemption_id
                        """,
                        promotion_id,
                        sell_invoice_id,
                        customer_id,
                    )

                    await _apply_promotion_benefits(
                        connection,
                        promotion_id,
                        sell_invoice_id,
                        promotion_redemption_id,
                    )

                # 7. Refresh sell_invoice totals from items + promo lines
                items_total = await connection.fetchval(
                    """
                    SELECT COALESCE(SUM(total_price), 0)
                    FROM sell_invoice_item
                    WHERE sell_invoice_id = $1
                    """,
                    sell_invoice_id,
                )
                discount_total = await connection.fetchval(
                    """
                    SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)
                    FROM sell_invoice_promotion_line
                    WHERE sell_invoice_id = $1
                    """,
                    sell_invoice_id,
                )
                items_total = Decimal(items_total or 0)
                discount_total = Decimal(discount_total or 0)
                await connection.execute(
                    """
                    UPDATE sell_invoice
                    SET total_amount = $2,
                        discount_amount = $3,
                        final_amount = $4
                    WHERE sell_invoice_id = $1
                    """,
                    sell_invoice_id,
                    items_total,
                    discount_total,
                    items_total - discount_total,
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
