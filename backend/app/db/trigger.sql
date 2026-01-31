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

-- sync_invoice_totals_from_promo_line: refresh totals when promotion lines change.
CREATE OR REPLACE FUNCTION sync_invoice_totals_from_promo_line()
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

CREATE TRIGGER trg_sell_invoice_promo_totals
AFTER INSERT OR UPDATE OR DELETE
ON "sell_invoice_promotion_line"
FOR EACH ROW
EXECUTE FUNCTION sync_invoice_totals_from_promo_line();

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

-- create_stock_movement_from_promo_line: deduct stock for free items from promotions.
CREATE OR REPLACE FUNCTION create_stock_movement_from_promo_line()
RETURNS trigger AS $$
BEGIN
  IF NEW.line_type <> 'FREE_ITEM' THEN
    RETURN NEW;
  END IF;

  IF NEW.free_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.free_qty_base_unit IS NULL OR NEW.free_qty_base_unit = 0 THEN
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
    NEW.free_item_id,
    'USE_FOR_PROMOTION',
    -NEW.free_qty_base_unit,
    NEW.sell_invoice_id,
    NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promo_line_stock_movement
AFTER INSERT
ON "sell_invoice_promotion_line"
FOR EACH ROW
EXECUTE FUNCTION create_stock_movement_from_promo_line();

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

-- PROMOTIONS (stacking + benefit application)
-- compare_numeric: compare two numbers using a rule operator.
CREATE OR REPLACE FUNCTION compare_numeric(lhs decimal, op promotion_rule_op, rhs decimal)
RETURNS boolean AS $$
BEGIN
  IF lhs IS NULL OR rhs IS NULL THEN
    RETURN false;
  END IF;

  CASE op
    WHEN 'EQ' THEN
      RETURN lhs = rhs;
    WHEN 'GTE' THEN
      RETURN lhs >= rhs;
    WHEN 'LTE' THEN
      RETURN lhs <= rhs;
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- promotion_rules_satisfied: evaluate condition groups/rules for a promotion.
CREATE OR REPLACE FUNCTION promotion_rules_satisfied(
  p_promotion_id bigint,
  p_sell_invoice_id bigint,
  p_customer_id bigint
)
RETURNS boolean AS $$
DECLARE
  group_rec RECORD;
  rule_rec RECORD;
  invoice_total decimal(10,2);
  group_ok boolean;
  rule_ok boolean;
  item_qty decimal(10,2);
  wallet_topup decimal(10,2);
  has_item boolean;
  prior_invoices int;
  group_count int;
BEGIN
  SELECT COUNT(*)
  INTO group_count
  FROM "promotion_condition_group"
  WHERE promotion_id = p_promotion_id;

  IF group_count = 0 THEN
    RETURN true;
  END IF;

  SELECT COALESCE(SUM(total_price), 0)
  INTO invoice_total
  FROM "sell_invoice_item"
  WHERE sell_invoice_id = p_sell_invoice_id;

  FOR group_rec IN
    SELECT condition_group_id
    FROM "promotion_condition_group"
    WHERE promotion_id = p_promotion_id
    ORDER BY sort_order
  LOOP
    group_ok := true;

    FOR rule_rec IN
      SELECT *
      FROM "promotion_condition_rule"
      WHERE condition_group_id = group_rec.condition_group_id
    LOOP
      rule_ok := false;

      IF rule_rec.rule_type = 'MIN_SPEND' THEN
        rule_ok := compare_numeric(invoice_total, rule_rec.op, rule_rec.amount_value);

      ELSIF rule_rec.rule_type = 'HAS_ITEM' THEN
        IF rule_rec.item_id IS NULL THEN
          rule_ok := false;
        ELSE
          SELECT EXISTS (
            SELECT 1
            FROM "sell_invoice_item"
            WHERE sell_invoice_id = p_sell_invoice_id
              AND item_id = rule_rec.item_id
          )
          INTO has_item;
          rule_ok := has_item;
        END IF;

      ELSIF rule_rec.rule_type = 'MIN_QTY_ITEM' THEN
        IF rule_rec.item_id IS NULL THEN
          rule_ok := false;
        ELSE
          SELECT COALESCE(SUM(qty), 0)
          INTO item_qty
          FROM "sell_invoice_item"
          WHERE sell_invoice_id = p_sell_invoice_id
            AND item_id = rule_rec.item_id;
          rule_ok := compare_numeric(item_qty, rule_rec.op, rule_rec.qty_base_unit);
        END IF;

      ELSIF rule_rec.rule_type = 'NEW_CUSTOMER_ONLY' THEN
        SELECT COUNT(*)
        INTO prior_invoices
        FROM "sell_invoice"
        WHERE customer_id = p_customer_id
          AND sell_invoice_id <> p_sell_invoice_id;
        rule_ok := (prior_invoices = 0);

      ELSIF rule_rec.rule_type = 'MIN_WALLET_TOPUP' THEN
        SELECT COALESCE(SUM(amount), 0)
        INTO wallet_topup
        FROM "wallet_movement"
        WHERE customer_id = p_customer_id
          AND amount > 0;
        rule_ok := compare_numeric(wallet_topup, rule_rec.op, rule_rec.amount_value);
      END IF;

      IF rule_ok = false THEN
        group_ok := false;
        EXIT;
      END IF;
    END LOOP;

    IF group_ok THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- enforce_promotion_stackable: allow only one non-stackable promo per invoice.
CREATE OR REPLACE FUNCTION enforce_promotion_stackable()
RETURNS trigger AS $$
DECLARE
  new_is_stackable boolean;
  conflict_exists boolean;
BEGIN
  SELECT is_stackable
  INTO new_is_stackable
  FROM "promotion"
  WHERE promotion_id = NEW.promotion_id;

  IF new_is_stackable IS NULL THEN
    RETURN NEW;
  END IF;

  IF new_is_stackable = false THEN
    SELECT EXISTS (
      SELECT 1
      FROM "sell_invoice_promotion_line" sip
      JOIN "promotion" p
        ON p.promotion_id = sip.promotion_id
      WHERE sip.sell_invoice_id = NEW.sell_invoice_id
        AND p.is_stackable = false
        AND sip.promotion_id <> NEW.promotion_id
    )
    INTO conflict_exists;

    IF conflict_exists THEN
      RAISE EXCEPTION 'Only one non-stackable promotion allowed per invoice';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_promotion_stackable
BEFORE INSERT OR UPDATE
ON "sell_invoice_promotion_line"
FOR EACH ROW
EXECUTE FUNCTION enforce_promotion_stackable();

-- apply_promotion_benefits_from_redemption: create promo lines from promotion_benefit rules.
CREATE OR REPLACE FUNCTION apply_promotion_benefits_from_redemption()
RETURNS trigger AS $$
DECLARE
  benefit RECORD;
  invoice_total decimal(10,2);
  target_total decimal(10,2);
  discount_amount decimal(10,2);
  credit_amount decimal(10,2);
  free_item_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "sell_invoice_item"
    WHERE sell_invoice_id = NEW.sell_invoice_id
  ) THEN
    RAISE EXCEPTION 'Insert sell_invoice_item before promotion_redemption';
  END IF;

  IF NOT promotion_rules_satisfied(NEW.promotion_id, NEW.sell_invoice_id, NEW.customer_id) THEN
    RAISE EXCEPTION 'Promotion rules not satisfied for promotion_id %', NEW.promotion_id;
  END IF;

  SELECT COALESCE(SUM(total_price), 0)
  INTO invoice_total
  FROM "sell_invoice_item"
  WHERE sell_invoice_id = NEW.sell_invoice_id;

  FOR benefit IN
    SELECT *
    FROM "promotion_benefit"
    WHERE promotion_id = NEW.promotion_id
  LOOP
    IF benefit.target_scope = 'INVOICE_TOTAL' THEN
      target_total := invoice_total;
    ELSE
      SELECT COALESCE(SUM(total_price), 0)
      INTO target_total
      FROM "sell_invoice_item"
      WHERE sell_invoice_id = NEW.sell_invoice_id
        AND item_id = benefit.target_item_id;
    END IF;

    IF benefit.benefit_type = 'PERCENT_DISCOUNT' THEN
      IF benefit.value_percent IS NULL OR target_total <= 0 THEN
        CONTINUE;
      END IF;
      discount_amount := round(target_total * benefit.value_percent / 100.0, 2);
      IF discount_amount > 0 THEN
        INSERT INTO "sell_invoice_promotion_line" (
          "sell_invoice_id",
          "promotion_redemption_id",
          "promotion_id",
          "promotion_benefit_id",
          "line_type",
          "amount",
          "created_at"
        )
        VALUES (
          NEW.sell_invoice_id,
          NEW.promotion_redemption_id,
          NEW.promotion_id,
          benefit.promotion_benefit_id,
          'DISCOUNT',
          -discount_amount,
          now()
        );
      END IF;

    ELSIF benefit.benefit_type = 'AMOUNT_DISCOUNT' THEN
      IF benefit.value_amount IS NULL OR target_total <= 0 THEN
        CONTINUE;
      END IF;
      discount_amount := LEAST(benefit.value_amount, target_total);
      IF discount_amount > 0 THEN
        INSERT INTO "sell_invoice_promotion_line" (
          "sell_invoice_id",
          "promotion_redemption_id",
          "promotion_id",
          "promotion_benefit_id",
          "line_type",
          "amount",
          "created_at"
        )
        VALUES (
          NEW.sell_invoice_id,
          NEW.promotion_redemption_id,
          NEW.promotion_id,
          benefit.promotion_benefit_id,
          'DISCOUNT',
          -discount_amount,
          now()
        );
      END IF;

    ELSIF benefit.benefit_type = 'FREE_ITEM' THEN
      free_item_id := COALESCE(benefit.free_item_id, benefit.target_item_id);
      IF free_item_id IS NULL THEN
        CONTINUE;
      END IF;
      IF benefit.free_qty_base_unit IS NULL OR benefit.free_qty_base_unit <= 0 THEN
        CONTINUE;
      END IF;
      INSERT INTO "sell_invoice_promotion_line" (
        "sell_invoice_id",
        "promotion_redemption_id",
        "promotion_id",
        "promotion_benefit_id",
        "line_type",
        "amount",
        "free_item_id",
        "free_qty_base_unit",
        "created_at"
      )
      VALUES (
        NEW.sell_invoice_id,
        NEW.promotion_redemption_id,
        NEW.promotion_id,
        benefit.promotion_benefit_id,
        'FREE_ITEM',
        0,
        free_item_id,
        benefit.free_qty_base_unit,
        now()
      );

    ELSIF benefit.benefit_type = 'WALLET_CREDIT' THEN
      IF benefit.value_amount IS NOT NULL THEN
        credit_amount := benefit.value_amount;
      ELSIF benefit.value_percent IS NOT NULL THEN
        credit_amount := round(target_total * benefit.value_percent / 100.0, 2);
      ELSE
        CONTINUE;
      END IF;

      IF credit_amount <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO "sell_invoice_promotion_line" (
        "sell_invoice_id",
        "promotion_redemption_id",
        "promotion_id",
        "promotion_benefit_id",
        "line_type",
        "amount",
        "wallet_credit_amount",
        "created_at"
      )
      VALUES (
        NEW.sell_invoice_id,
        NEW.promotion_redemption_id,
        NEW.promotion_id,
        benefit.promotion_benefit_id,
        'WALLET_CREDIT',
        0,
        credit_amount,
        now()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_promotion_benefits
AFTER INSERT
ON "promotion_redemption"
FOR EACH ROW
EXECUTE FUNCTION apply_promotion_benefits_from_redemption();

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
