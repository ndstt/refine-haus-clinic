-- TRIGGERS & FUNCTIONS

-- HELPER FUNCTIONS
-- normalize_code_part: sanitize text into a lowercase slug for codes.
CREATE OR REPLACE FUNCTION normalize_code_part(input_text text)
RETURNS text AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN trim(both '-' from regexp_replace(lower(input_text), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- CODE GENERATION (customer/supplier/item/invoice/receipt)
-- set_customer_code: auto-generate customer_code from customer_id.
CREATE OR REPLACE FUNCTION set_customer_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    IF NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    NEW.customer_code := 'C-' || lpad(NEW.customer_id::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_code
BEFORE INSERT OR UPDATE OF customer_id
ON "customer"
FOR EACH ROW
EXECUTE FUNCTION set_customer_code();

-- set_supplier_code: auto-generate supplier_code from supplier_id.
CREATE OR REPLACE FUNCTION set_supplier_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.supplier_code IS NULL OR NEW.supplier_code = '' THEN
    IF NEW.supplier_id IS NULL THEN
      RETURN NEW;
    END IF;
    NEW.supplier_code := 'S-' || lpad(NEW.supplier_id::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_code
BEFORE INSERT OR UPDATE OF supplier_id
ON "supplier"
FOR EACH ROW
EXECUTE FUNCTION set_supplier_code();

-- set_item_code: auto-generate sku using item_type, name, item_id, and variant.
CREATE OR REPLACE FUNCTION set_item_code()
RETURNS trigger AS $$
DECLARE
  prefix text;
  name_part text;
  variant_part text;
  item_id_part text;
BEGIN
  IF NEW.item_id IS NULL THEN
    RETURN NEW;
  END IF;

  prefix := CASE NEW.item_type
    WHEN 'MEDICINE' THEN 'MED'
    WHEN 'MEDICAL_TOOL' THEN 'TOOL'
    ELSE 'ITEM'
  END;

  name_part := normalize_code_part(NEW.name);
  IF name_part IS NULL OR name_part = '' THEN
    name_part := 'ITEM';
  END IF;
  name_part := upper(name_part);

  variant_part := normalize_code_part(NEW.variant_name);
  IF variant_part IS NULL OR variant_part = '' THEN
    variant_part := 'default';
  END IF;

  item_id_part := lpad(NEW.item_id::text, 6, '0');
  NEW.sku := prefix || '-' || name_part || '-' || variant_part || '-' || item_id_part;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_code
BEFORE INSERT OR UPDATE OF item_id, item_type, name, variant_name
ON "item_catalog"
FOR EACH ROW
EXECUTE FUNCTION set_item_code();

-- set_invoice_no: auto-generate invoice_no using customer_id, year, and invoice_id.
CREATE OR REPLACE FUNCTION set_invoice_no()
RETURNS trigger AS $$
DECLARE
  invoice_year text;
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    IF NEW.sell_invoice_id IS NULL OR NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    invoice_year := to_char(COALESCE(NEW.issue_at, now()), 'YYYY');
    NEW.invoice_no := 'INV-' || lpad(NEW.customer_id::text, 6, '0')
      || '-' || invoice_year
      || '-' || lpad(NEW.sell_invoice_id::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_no
BEFORE INSERT OR UPDATE OF sell_invoice_id, customer_id, issue_at
ON "sell_invoice"
FOR EACH ROW
EXECUTE FUNCTION set_invoice_no();

-- set_receipt_no: auto-generate receipt_no using invoice_no and payment sequence.
CREATE OR REPLACE FUNCTION set_receipt_no()
RETURNS trigger AS $$
DECLARE
  base_invoice_no text;
  seq_num int;
BEGIN
  IF NEW.receipt_no IS NULL OR NEW.receipt_no = '' THEN
    IF NEW.sell_invoice_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT invoice_no
    INTO base_invoice_no
    FROM sell_invoice
    WHERE sell_invoice_id = NEW.sell_invoice_id;

    IF base_invoice_no IS NULL THEN
      base_invoice_no := 'INV-' || lpad(NEW.sell_invoice_id::text, 6, '0');
    END IF;

    SELECT count(*) + 1
    INTO seq_num
    FROM payment
    WHERE sell_invoice_id = NEW.sell_invoice_id;

    NEW.receipt_no := base_invoice_no || '-' || lpad(seq_num::text, 2, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_receipt_no
BEFORE INSERT
ON "payment"
FOR EACH ROW
EXECUTE FUNCTION set_receipt_no();

-- PAYMENT FEES
-- set_payment_card_fee: compute card_fee and clinic_amount for card payments.
CREATE OR REPLACE FUNCTION set_payment_card_fee()
RETURNS trigger AS $$
DECLARE
  card_fee_amount decimal(10,2);
  invoice_total decimal(10,2);
  invoice_discount decimal(10,2);
  invoice_subtotal decimal(10,2);
BEGIN
  IF NEW.amount_customer_paid IS NULL THEN
    NEW.card_fee := NULL;
    NEW.clinic_amount := NULL;
    RETURN NEW;
  END IF;

  IF NEW.method = 'CARD' THEN
    -- Card fee is 3% of invoice subtotal (total - discount).
    SELECT total_amount, discount_amount
    INTO invoice_total, invoice_discount
    FROM "sell_invoice"
    WHERE sell_invoice_id = NEW.sell_invoice_id;

    invoice_subtotal := COALESCE(invoice_total, 0) - COALESCE(invoice_discount, 0);
    card_fee_amount := round(invoice_subtotal * 0.03, 2);
    NEW.card_fee := card_fee_amount;
    NEW.clinic_amount := NEW.amount_customer_paid - card_fee_amount;
  ELSE
    NEW.card_fee := 0;
    NEW.clinic_amount := NEW.amount_customer_paid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_card_fee
BEFORE INSERT OR UPDATE OF method, amount_customer_paid
ON "payment"
FOR EACH ROW
EXECUTE FUNCTION set_payment_card_fee();

-- CHAT ACTIVITY
-- touch_conversation_updated_at: refresh conversation updated_at when a new message arrives.
CREATE OR REPLACE FUNCTION touch_conversation_updated_at()
RETURNS trigger AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now()
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_touch_conversation
AFTER INSERT
ON messages
FOR EACH ROW
EXECUTE FUNCTION touch_conversation_updated_at();

-- WALLET BALANCE SYNC
-- refresh_customer_wallet_balance: recompute member_wallet_remain from wallet_movement.
CREATE OR REPLACE FUNCTION refresh_customer_wallet_balance(target_customer_id bigint)
RETURNS void AS $$
BEGIN
  UPDATE "customer"
  SET member_wallet_remain = COALESCE((
    SELECT SUM(amount)
    FROM "wallet_movement"
    WHERE customer_id = target_customer_id
  ), 0)
  WHERE customer_id = target_customer_id;
END;
$$ LANGUAGE plpgsql;

-- sync_wallet_balance_from_movement: keep wallet balance in sync after wallet_movement changes.
CREATE OR REPLACE FUNCTION sync_wallet_balance_from_movement()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_customer_wallet_balance(OLD.customer_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_customer_wallet_balance(NEW.customer_id);

  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM refresh_customer_wallet_balance(OLD.customer_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_movement_sync_balance
AFTER INSERT OR UPDATE OR DELETE
ON "wallet_movement"
FOR EACH ROW
EXECUTE FUNCTION sync_wallet_balance_from_movement();

-- INVOICE TOTALS (items + promotions)
-- refresh_sell_invoice_totals: recompute totals and final_amount for an invoice.
CREATE OR REPLACE FUNCTION refresh_sell_invoice_totals(target_invoice_id bigint)
RETURNS void AS $$
DECLARE
  items_total decimal(10,2);
  discount_total decimal(10,2);
  subtotal decimal(10,2);
  card_fee decimal(10,2);
  has_card_payment boolean;
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO items_total
  FROM "sell_invoice_item"
  WHERE sell_invoice_id = target_invoice_id;

  SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)
  INTO discount_total
  FROM "sell_invoice_promotion_line"
  WHERE sell_invoice_id = target_invoice_id;

  subtotal := items_total - discount_total;

  SELECT EXISTS (
    SELECT 1
    FROM "payment"
    WHERE sell_invoice_id = target_invoice_id
      AND method = 'CARD'
  )
  INTO has_card_payment;

  IF has_card_payment THEN
    card_fee := round(subtotal * 0.03, 2);
  ELSE
    card_fee := 0;
  END IF;

  UPDATE "sell_invoice"
  SET total_amount = items_total,
      discount_amount = discount_total,
      final_amount = subtotal + card_fee
  WHERE sell_invoice_id = target_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- sync_invoice_totals_from_sell_item: refresh totals when invoice items change.
CREATE OR REPLACE FUNCTION sync_invoice_totals_from_sell_item()
RETURNS trigger AS $$
DECLARE
  target_invoice_id bigint;
BEGIN
  target_invoice_id := COALESCE(NEW.sell_invoice_id, OLD.sell_invoice_id);
  IF target_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM refresh_sell_invoice_totals(target_invoice_id);

  IF TG_OP = 'UPDATE' AND OLD.sell_invoice_id IS DISTINCT FROM NEW.sell_invoice_id THEN
    PERFORM refresh_sell_invoice_totals(OLD.sell_invoice_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sell_invoice_item_totals
AFTER INSERT OR UPDATE OR DELETE
ON "sell_invoice_item"
FOR EACH ROW
EXECUTE FUNCTION sync_invoice_totals_from_sell_item();

-- INVOICE STATUS (from payments)
-- refresh_sell_invoice_status: set UNPAID/PARTIAL/PAID based on payments vs final_amount.
CREATE OR REPLACE FUNCTION refresh_sell_invoice_status(target_invoice_id bigint)
RETURNS void AS $$
DECLARE
  total_paid decimal(10,2);
  amount_due decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(amount_customer_paid), 0)
  INTO total_paid
  FROM "payment"
  WHERE sell_invoice_id = target_invoice_id;

  SELECT final_amount
  INTO amount_due
  FROM "sell_invoice"
  WHERE sell_invoice_id = target_invoice_id;

  UPDATE "sell_invoice"
  SET status = CASE
    WHEN amount_due IS NULL THEN status
    WHEN total_paid <= 0 THEN 'UNPAID'
    WHEN total_paid >= amount_due THEN 'PAID'
    ELSE 'PARTIAL'
  END
  WHERE sell_invoice_id = target_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- sync_invoice_status_from_payment: refresh status when payments change.
CREATE OR REPLACE FUNCTION sync_invoice_status_from_payment()
RETURNS trigger AS $$
DECLARE
  target_invoice_id bigint;
BEGIN
  target_invoice_id := COALESCE(NEW.sell_invoice_id, OLD.sell_invoice_id);
  IF target_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM refresh_sell_invoice_totals(target_invoice_id);
  PERFORM refresh_sell_invoice_status(target_invoice_id);

  IF TG_OP = 'UPDATE' AND OLD.sell_invoice_id IS DISTINCT FROM NEW.sell_invoice_id THEN
    PERFORM refresh_sell_invoice_totals(OLD.sell_invoice_id);
    PERFORM refresh_sell_invoice_status(OLD.sell_invoice_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_sync_invoice_status
AFTER INSERT OR UPDATE OR DELETE
ON "payment"
FOR EACH ROW
EXECUTE FUNCTION sync_invoice_status_from_payment();

-- STOCK MOVEMENT (sell/promo/purchase)
-- create_stock_movement_from_sell_item: deduct stock for sold items.
CREATE OR REPLACE FUNCTION create_stock_movement_from_sell_item()
RETURNS trigger AS $$
BEGIN
  IF NEW.item_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO "stock_movement" (
    "created_at",
    "item_id",
    "movement_type",
    "qty",
    "sell_invoice_id",
    "purchase_invoice_id"
  )
  VALUES (
    now(),
    NEW.item_id,
    'USE_FOR_TREATMENT',
    -NEW.qty,
    NEW.sell_invoice_id,
    NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sell_item_stock_movement
AFTER INSERT
ON "sell_invoice_item"
FOR EACH ROW
EXECUTE FUNCTION create_stock_movement_from_sell_item();

-- create_stock_movement_from_purchase_item: add stock for purchases.
CREATE OR REPLACE FUNCTION create_stock_movement_from_purchase_item()
RETURNS trigger AS $$
BEGIN
  IF NEW.item_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO "stock_movement" (
    "created_at",
    "item_id",
    "movement_type",
    "qty",
    "sell_invoice_id",
    "purchase_invoice_id"
  )
  VALUES (
    now(),
    NEW.item_id,
    'PURCHASE_IN',
    NEW.qty,
    NULL,
    NEW.purchase_invoice_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_item_stock_movement
AFTER INSERT
ON "purchase_invoice_item"
FOR EACH ROW
EXECUTE FUNCTION create_stock_movement_from_purchase_item();

-- STOCK ITEM QUANTITY (item_catalog current_qty)
-- refresh_item_quantity: recompute current_qty from stock_movement only.
CREATE OR REPLACE FUNCTION refresh_item_quantity(target_item_id bigint)
RETURNS void AS $$
BEGIN
  IF target_item_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "item_catalog" ic
  SET current_qty = COALESCE((
    SELECT SUM(sm.qty)
    FROM "stock_movement" sm
    WHERE sm.item_id = ic.item_id
  ), 0)
  WHERE ic.item_id = target_item_id;
END;
$$ LANGUAGE plpgsql;

-- sync_item_quantity_from_stock_movement: keep item total in sync when stock moves.
CREATE OR REPLACE FUNCTION sync_item_quantity_from_stock_movement()
RETURNS trigger AS $$
DECLARE
  target_item_id bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_item_id := OLD.item_id;
    PERFORM refresh_item_quantity(target_item_id);
    RETURN OLD;
  END IF;

  target_item_id := NEW.item_id;
  PERFORM refresh_item_quantity(target_item_id);

  IF TG_OP = 'UPDATE' AND OLD.item_id IS DISTINCT FROM NEW.item_id THEN
    PERFORM refresh_item_quantity(OLD.item_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movement_item_qty
AFTER INSERT OR UPDATE OR DELETE
ON "stock_movement"
FOR EACH ROW
EXECUTE FUNCTION sync_item_quantity_from_stock_movement();

-- sync_item_quantity_from_item_catalog: re-sync when unit_per_package changes.
CREATE OR REPLACE FUNCTION sync_item_quantity_from_item_catalog()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_item_quantity(NEW.item_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_catalog_item_qty
AFTER UPDATE OF unit_per_package
ON "item_catalog"
FOR EACH ROW
EXECUTE FUNCTION sync_item_quantity_from_item_catalog();

-- MAINTENANCE (expired stock)
-- waste_expired_stock: write WASTE movements for expired purchase lots.
CREATE OR REPLACE FUNCTION waste_expired_stock()
RETURNS void AS $$
INSERT INTO stock_movement (
  created_at,
  item_id,
  movement_type,
  qty,
  sell_invoice_id,
  purchase_invoice_id
)
SELECT
  now(),
  pii.item_id,
  'WASTE',
  -pii.qty,
  NULL,
  pii.purchase_invoice_id
FROM "purchase_invoice_item" pii
WHERE pii.expire_date IS NOT NULL
  AND pii.expire_date < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1
    FROM "stock_movement" sm
    WHERE sm.item_id = pii.item_id
      AND sm.purchase_invoice_id = pii.purchase_invoice_id
      AND sm.movement_type = 'WASTE'
  );
$$ LANGUAGE sql;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'waste-expired-daily',
  '0 0 * * *',
  $$SELECT waste_expired_stock();$$
);

-- DAILY STOCK SNAPSHOT
-- snapshot_daily_stock: store daily item totals from stock_movement.
CREATE OR REPLACE FUNCTION snapshot_daily_stock(p_stock_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO "daily_stock" (
    "stock_date",
    "item_id",
    "qty"
  )
  SELECT
    p_stock_date,
    ic.item_id,
    COALESCE(SUM(sm.qty * COALESCE(ic.unit_per_package, 1)), 0)
  FROM "item_catalog" ic
  LEFT JOIN "stock_movement" sm
    ON sm.item_id = ic.item_id
    AND sm.created_at < (p_stock_date + INTERVAL '1 day')
  GROUP BY ic.item_id
  ON CONFLICT ("stock_date", "item_id")
  DO UPDATE SET "qty" = EXCLUDED."qty";
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'daily-stock-snapshot',
  '5 0 * * *',
  $$SELECT snapshot_daily_stock();$$
);
