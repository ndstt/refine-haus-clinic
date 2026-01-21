-- ENUM
CREATE TYPE "item_type" AS ENUM (
  'MEDICINE',
  'MEDICAL_TOOL'
);

CREATE TYPE "invoice_status" AS ENUM (
  'UNPAID',
  'PARTIAL',
  'PAID'
);

CREATE TYPE "payment_method" AS ENUM (
  'CASH',
  'CARD',
  'MEMBER_WALLET'
);

CREATE TYPE "tracking_mode" AS ENUM (
  'PER_SESSION',
  'WITHDRAW'
);

CREATE TYPE "unit_type" AS ENUM (
  'U',
  'CC',
  'PIECE'
);

CREATE TYPE "stock_movement_type" AS ENUM (
  'OPENING_BALANCE',
  'PURCHASE_IN',
  'USE_FOR_PROMOTION',
  'USE_FOR_TREATMENT',
  'WASTE',
  'ADJUST'
);

CREATE TYPE "promotion_apply_mode" AS ENUM (
  'AUTO',
  'COUPON'
);

CREATE TYPE "promotion_benefit_type" AS ENUM (
  'PERCENT_DISCOUNT',
  'AMOUNT_DISCOUNT',
  'FREE_ITEM',
  'WALLET_CREDIT'
);

CREATE TYPE "promotion_target_scope" AS ENUM (
  'INVOICE_TOTAL',
  'LINE_ITEM'
);

CREATE TYPE "promotion_rule_type" AS ENUM (
  'MIN_SPEND',
  'HAS_ITEM',
  'MIN_QTY_ITEM',
  'NEW_CUSTOMER_ONLY',
  'MIN_WALLET_TOPUP'
);

CREATE TYPE "promotion_rule_op" AS ENUM (
  'EQ',
  'GTE',
  'LTE'
);

CREATE TYPE "invoice_promo_line_type" AS ENUM (
  'DISCOUNT',
  'FREE_ITEM',
  'WALLET_CREDIT'
);

CREATE TYPE "chat_role" AS ENUM (
  'USER',
  'SYSTEM'
);

-- TABLES
-- A chat session/conversation
CREATE TABLE conversations (
  conversation_id            bigint PRIMARY KEY,
  title         TEXT,
  created_at    timestamp DEFAULT (now()),
  updated_at    timestamp DEFAULT (now())
);

-- One message per turn (user/system)
CREATE TABLE messages (
  message_id              bigint PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  role            chat_role NOT NULL,
  content         TEXT NOT NULL,
  token_count     INT,
  model           TEXT,
  created_at      timestamp DEFAULT (now())
);

CREATE TABLE "customer" (
  "customer_id" bigint PRIMARY KEY,
  "customer_code" varchar(50) UNIQUE,
  "full_name" varchar,
  "nickname" varchar,
  "phone" varchar(10),
  "date_of_birth" date,
  "member_wallet_remain" decimal(10,2)
);

CREATE TABLE "supplier" (
  "supplier_id" bigint PRIMARY KEY,
  "supplier_code" varchar(50) UNIQUE,
  "description" varchar,
  "name" varchar,
  "phone" varchar(10),
  "address" varchar
);

CREATE TABLE "item_catalog" (
  "item_id" bigint PRIMARY KEY,
  "sku" varchar(50) UNIQUE,
  "item_type" item_type,
  "name" varchar,
  "variant_name" varchar,
  "sell_price" decimal(10,2),
  "unit" unit_type,
  "unit_per_package" decimal(10,2),
  "tracking_mode" tracking_mode,
  "restock_threshlod" decimal(10,2),
  "description" varchar
);

CREATE TABLE "promotion" (
  "promotion_id" bigint PRIMARY KEY,
  "code" varchar(50) UNIQUE,
  "name" varchar,
  "description" varchar,
  "apply_mode" promotion_apply_mode,
  "priority" int DEFAULT 100,
  "is_stackable" boolean DEFAULT false,
  "start_at" timestamp,
  "end_at" timestamp,
  "is_active" boolean DEFAULT true,
  "max_redemptions_total" int,
  "max_redemptions_per_customer" int,
  "created_at" timestamp DEFAULT (now())
);

COMMENT ON COLUMN "promotion"."code" IS 'nullable (coupon code)';
COMMENT ON COLUMN "promotion"."description" IS 'nullable';
COMMENT ON COLUMN "promotion"."end_at" IS 'nullable';
COMMENT ON COLUMN "promotion"."max_redemptions_total" IS 'nullable';
COMMENT ON COLUMN "promotion"."max_redemptions_per_customer" IS 'nullable';

CREATE TABLE "purchase_invoice" (
  "purchase_invoice_id" bigint PRIMARY KEY,
  "purchase_no" varchar(50) UNIQUE,
  "supplier_id" bigint REFERENCES "supplier" ("supplier_id") ON DELETE CASCADE,
  "issue_date" datetime,
  "total_amount" decimal(10,2)
);

CREATE TABLE "sell_invoice" (
  "sell_invoice_id" bigint PRIMARY KEY,
  "invoice_no" varchar(50) UNIQUE,
  "customer_id" bigint REFERENCES "customer" ("customer_id") ON DELETE CASCADE,
  "issued_at" datetime,
  "total_amount" decimal(10,2),
  "discount_amount" decimal(10,2),
  "final_amount" decimal(10,2),
  "status" invoice_status
);

CREATE TABLE "wallet_movement" (
  "created_at" timestamp DEFAULT (now()),
  "customer_id" bigint REFERENCES "customer" ("customer_id") ON DELETE CASCADE,
  "amount" decimal(10,2),
  PRIMARY KEY ("created_at", "customer_id")
);

CREATE TABLE "sell_invoice_item" (
  "sell_item_id" bigint REFERENCES "item_catalog" ("item_id") ON DELETE CASCADE,
  "sell_invoice_id" bigint REFERENCES "sell_invoice" ("sell_invoice_id") ON DELETE CASCADE,
  "description" varchar,
  "qty" int,
  "total_price" decimal(10,2),
  PRIMARY KEY ("sell_item_id", "sell_invoice_id")
);

CREATE TABLE "payment" (
  "payment_time" timestamp DEFAULT (now()),
  "sell_invoice_id" bigint REFERENCES "sell_invoice" ("sell_invoice_id") ON DELETE CASCADE,
  "receipt_no" varchar(50) UNIQUE,
  "method" payment_method,
  "amount_customer_paid" decimal(10,2),
  "card_fee" decimal(10,2),
  "clinic_amount" decimal(10,2),
  PRIMARY KEY ("payment_time", "sell_invoice_id")
);

CREATE TABLE "purchase_invoice_item" (
  "purchase_item_id" bigint REFERENCES "purchase_invoice" ("purchase_invoice_id") ON DELETE CASCADE,
  "purchase_invoice_id" bigint,
  "qty" int,
  "purchase_price_per_unit" decimal(10,2),
  PRIMARY KEY ("purchase_item_id", "purchase_invoice_id")
);

CREATE TABLE "stock_movement" (
  "created_at" timestamp DEFAULT (now()),
  "item_id" bigint REFERENCES "item_catalog" ("item_id") ON DELETE CASCADE,
  "movement_type" stock_movement_type,
  "qty" int,
  "sell_invoice_id" bigint REFERENCES "sell_invoice" ("sell_invoice_id") ON DELETE CASCADE,
  "purchase_invoice_id" bigint REFERENCES "purchase_invoice" ("purchase_invoice_id") ON DELETE CASCADE,
  "expired_at" timestamp,
  PRIMARY KEY ("created_at", "item_id")
);

CREATE TABLE "treatment_recipe" (
  "treatment_id" bigint,
  "item_id" bigint REFERENCES "item_catalog" ("item_id") ON DELETE CASCADE,
  "qty_per_session" decimal(10,2),
  "sell_price" decimal(10,2),
  "description" varchar,
  PRIMARY KEY ("treatment_id", "item_id")
);

CREATE TABLE "promotion_benefit" (
  "promotion_benefit_id" bigint PRIMARY KEY,
  "promotion_id" bigint NOT NULL REFERENCES "promotion" ("promotion_id") ON DELETE CASCADE,
  "benefit_type" promotion_benefit_type,
  "target_scope" promotion_target_scope,
  "target_item_id" bigint,
  "value_percent" decimal(10,2),
  "value_amount" decimal(10,2),
  "free_item_id" bigint,
  "free_qty_base_unit" decimal(10,2)
);

COMMENT ON COLUMN "promotion_benefit"."target_item_id" IS 'nullable, FK -> item_catalog.item_id (for LINE_ITEM scope)';
COMMENT ON COLUMN "promotion_benefit"."value_percent" IS 'nullable, for PERCENT_DISCOUNT';
COMMENT ON COLUMN "promotion_benefit"."value_amount" IS 'nullable, for AMOUNT_DISCOUNT / WALLET_CREDIT';
COMMENT ON COLUMN "promotion_benefit"."free_item_id" IS 'nullable, FK -> item_catalog.item_id (for FREE_ITEM)';
COMMENT ON COLUMN "promotion_benefit"."free_qty_base_unit" IS 'nullable, base unit qty for FREE_ITEM';

CREATE TABLE "promotion_condition_group" (
  "condition_group_id" bigint PRIMARY KEY,
  "promotion_id" bigint NOT NULL REFERENCES "promotion" ("promotion_id") ON DELETE CASCADE,
  "sort_order" int NOT NULL DEFAULT 1
);

COMMENT ON COLUMN "promotion_condition_group"."sort_order" IS 'OR groups ordered for evaluation/UI';

CREATE TABLE "promotion_condition_rule" (
  "condition_rule_id" bigint PRIMARY KEY,
  "condition_group_id" bigint NOT NULL REFERENCES "promotion_condition_group" ("condition_group_id") ON DELETE CASCADE,
  "rule_type" promotion_rule_type NOT NULL,
  "op" promotion_rule_op NOT NULL,
  "amount_value" decimal(10,2),
  "item_id" bigint,
  "qty_base_unit" decimal(10,2),
  "text_value" varchar(100)
);

COMMENT ON TABLE "promotion_condition_rule" IS 'Rules inside same group = AND. Different groups = OR.';
COMMENT ON COLUMN "promotion_condition_rule"."amount_value" IS 'Used by MIN_SPEND etc. nullable';
COMMENT ON COLUMN "promotion_condition_rule"."item_id" IS 'FK -> item_catalog.item_id nullable';
COMMENT ON COLUMN "promotion_condition_rule"."qty_base_unit" IS 'Used by MIN_QTY_ITEM nullable';
COMMENT ON COLUMN "promotion_condition_rule"."text_value" IS 'Used by MEMBER_TIER_IN or similar nullable';

CREATE TABLE "promotion_redemption" (
  "promotion_redemption_id" bigint PRIMARY KEY,
  "promotion_id" bigint NOT NULL REFERENCES "promotion" ("promotion_id") ON DELETE CASCADE,
  "sell_invoice_id" bigint NOT NULL REFERENCES "sell_invoice" ("sell_invoice_id") ON DELETE CASCADE,
  "customer_id" bigint NOT NULL REFERENCES "customer" ("customer_id") ON DELETE CASCADE,
  "coupon_code_used" varchar(50),
  "discount_total" decimal(10,2) DEFAULT 0,
  "wallet_credit_total" decimal(10,2) DEFAULT 0,
  "redeemed_at" timestamp DEFAULT (now())
);

COMMENT ON COLUMN "promotion_redemption"."sell_invoice_id" IS 'FK -> sell_invoice.sell_invoice_id';
COMMENT ON COLUMN "promotion_redemption"."customer_id" IS 'FK -> customer.customer_id';
COMMENT ON COLUMN "promotion_redemption"."coupon_code_used" IS 'nullable';

CREATE TABLE "sell_invoice_promotion_line" (
  "sell_invoice_promotion_line_id" bigint PRIMARY KEY,
  "sell_invoice_id" bigint NOT NULL REFERENCES "sell_invoice" ("sell_invoice_id") ON DELETE CASCADE,
  "sell_invoice_item_id" bigint,
  "promotion_redemption_id" bigint REFERENCES "promotion_redemption" ("promotion_redemption_id") ON DELETE CASCADE,
  "promotion_id" bigint NOT NULL REFERENCES "promotion" ("promotion_id") ON DELETE CASCADE,
  "promotion_benefit_id" bigint REFERENCES "promotion_benefit" ("promotion_benefit_id") ON DELETE CASCADE,
  "line_type" invoice_promo_line_type NOT NULL,
  "amount" decimal(10,2) NOT NULL DEFAULT 0,
  "free_item_id" bigint,
  "free_qty_base_unit" decimal(10,2),
  "stock_movement_id" bigint,
  "wallet_credit_amount" decimal(10,2),
  "wallet_movement_id" bigint,
  "description" varchar(255),
  "created_at" timestamp
);

COMMENT ON COLUMN "sell_invoice_promotion_line"."sell_invoice_item_id" IS 'nullable, FK -> sell_invoice_item.sell_invoice_item_id';
COMMENT ON COLUMN "sell_invoice_promotion_line"."amount" IS 'Discount should be negative';
COMMENT ON COLUMN "sell_invoice_promotion_line"."free_item_id" IS 'nullable, FK -> item_catalog.item_id';
COMMENT ON COLUMN "sell_invoice_promotion_line"."free_qty_base_unit" IS 'nullable';
COMMENT ON COLUMN "sell_invoice_promotion_line"."stock_movement_id" IS 'nullable, FK -> stock_movement.stock_movement_id';
COMMENT ON COLUMN "sell_invoice_promotion_line"."wallet_credit_amount" IS 'nullable';
COMMENT ON COLUMN "sell_invoice_promotion_line"."wallet_movement_id" IS 'nullable, FK -> wallet_movement.wallet_movement_id';
COMMENT ON COLUMN "sell_invoice_promotion_line"."description" IS 'nullable';
COMMENT ON COLUMN "sell_invoice_promotion_line"."created_at" IS 'default now()';

-- TRIGGERS & FUNCTIONS
CREATE OR REPLACE FUNCTION normalize_code_part(input_text text)
RETURNS text AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN trim(both '-' from regexp_replace(lower(input_text), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

CREATE OR REPLACE FUNCTION set_item_code()
RETURNS trigger AS $$
DECLARE
  base_code text;
  name_part text;
  max_name_len int;
  type_digit text;
BEGIN
  IF NEW.item_id IS NULL THEN
    RETURN NEW;
  END IF;

  type_digit := CASE NEW.item_type
    WHEN 'MEDICINE' THEN '0'
    WHEN 'MEDICAL_TOOL' THEN '1'
    ELSE '9'
  END;
  base_code := 'I' || type_digit || '-' || lpad(NEW.item_id::text, 6, '0');
  name_part := normalize_code_part(concat_ws('-', NEW.name, NEW.variant_name));
  max_name_len := 50 - length(base_code) - 1;

  IF name_part IS NULL OR name_part = '' OR max_name_len <= 0 THEN
    NEW.sku := base_code;
  ELSE
    NEW.sku := base_code || '-' || left(name_part, max_name_len);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_code
BEFORE INSERT OR UPDATE OF item_id, name, variant_name
ON "item_catalog"
FOR EACH ROW
EXECUTE FUNCTION set_item_code();

CREATE OR REPLACE FUNCTION set_invoice_no()
RETURNS trigger AS $$
DECLARE
  invoice_year text;
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    IF NEW.sell_invoice_id IS NULL OR NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    invoice_year := to_char(COALESCE(NEW.issued_at, now()), 'YYYY');
    NEW.invoice_no := 'INV-' || lpad(NEW.customer_id::text, 6, '0')
      || '-' || invoice_year
      || '-' || lpad(NEW.sell_invoice_id::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_no
BEFORE INSERT OR UPDATE OF sell_invoice_id, customer_id, issued_at
ON "sell_invoice"
FOR EACH ROW
EXECUTE FUNCTION set_invoice_no();

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

CREATE OR REPLACE FUNCTION touch_conversation_updated_at()
RETURNS trigger AS $$
BEGIN
  UPDATE conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_touch_conversation
AFTER INSERT
ON messages
FOR EACH ROW
EXECUTE FUNCTION touch_conversation_updated_at();

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

CREATE OR REPLACE FUNCTION refresh_sell_invoice_totals(target_invoice_id bigint)
RETURNS void AS $$
DECLARE
  items_total decimal(10,2);
  discount_total decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO items_total
  FROM "sell_invoice_item"
  WHERE sell_invoice_id = target_invoice_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO discount_total
  FROM "sell_invoice_promotion_line"
  WHERE sell_invoice_id = target_invoice_id
    AND line_type = 'DISCOUNT';

  UPDATE "sell_invoice"
  SET total_amount = items_total,
      discount_amount = discount_total,
      final_amount = items_total + discount_total
  WHERE sell_invoice_id = target_invoice_id;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION sync_invoice_status_from_payment()
RETURNS trigger AS $$
DECLARE
  target_invoice_id bigint;
BEGIN
  target_invoice_id := COALESCE(NEW.sell_invoice_id, OLD.sell_invoice_id);
  IF target_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM refresh_sell_invoice_status(target_invoice_id);

  IF TG_OP = 'UPDATE' AND OLD.sell_invoice_id IS DISTINCT FROM NEW.sell_invoice_id THEN
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

CREATE OR REPLACE FUNCTION create_stock_movement_from_sell_item()
RETURNS trigger AS $$
BEGIN
  IF NEW.sell_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO "stock_movement" (
    "created_at",
    "item_id",
    "movement_type",
    "qty",
    "sell_invoice_id",
    "purchase_invoice_id",
    "expired_at"
  )
  VALUES (
    now(),
    NEW.sell_item_id,
    'USE_FOR_TREATMENT',
    -NEW.qty,
    NEW.sell_invoice_id,
    NULL,
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

CREATE OR REPLACE FUNCTION create_stock_movement_from_purchase_item()
RETURNS trigger AS $$
BEGIN
  IF NEW.purchase_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Assumes purchase_item_id stores item_catalog.item_id.
  INSERT INTO "stock_movement" (
    "created_at",
    "item_id",
    "movement_type",
    "qty",
    "sell_invoice_id",
    "purchase_invoice_id",
    "expired_at"
  )
  VALUES (
    now(),
    NEW.purchase_item_id,
    'PURCHASE_IN',
    NEW.qty,
    NULL,
    NEW.purchase_invoice_id,
    NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_item_stock_movement
AFTER INSERT
ON "purchase_invoice_item"
FOR EACH ROW
EXECUTE FUNCTION create_stock_movement_from_purchase_item();
