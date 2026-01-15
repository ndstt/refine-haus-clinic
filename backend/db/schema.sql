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
  'USE_TREATMENT',
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

-- TABLES
CREATE TABLE "sell_invoice_item" (
  "sell_item_id" bigint,
  "sell_invoice_id" bigint,
  "item_type" item_type,
  "description" varchar,
  "qty" int,
  "total_price" decimal(10,2),
  PRIMARY KEY ("sell_item_id", "sell_invoice_id")
);

CREATE TABLE "sell_invoice" (
  "sell_invoice_id" bigint PRIMARY KEY,
  "customer_id" bigint,
  "issued_at" datetime,
  "total_amount" decimal(10,2),
  "discount_amount" decimal(10,2),
  "final_amount" decimal(10,2),
  "status" invoice_status,
  "note" varchar
);

CREATE TABLE "payment" (
  "payment_time" timestamp DEFAULT (now()),
  "sell_invoice_id" bigint,
  "method" payment_method,
  "amount_customer_paid" decimal(10,2),
  "card_fee" decimal(10,2),
  "clinic_amount" decimal(10,2),
  PRIMARY KEY ("payment_time", "sell_invoice_id")
);

CREATE TABLE "customer" (
  "customer_id" bigint PRIMARY KEY,
  "full_name" varchar,
  "nickname" varchar,
  "phone" varchar(10),
  "date_of_birth" date,
  "member_wallet_remain" decimal(10,2)
);

CREATE TABLE "wallet_movement" (
  "created_at" timestamp DEFAULT (now()),
  "customer_id" bigint,
  "amount" decimal(10,2),
  PRIMARY KEY ("created_at", "customer_id")
);

CREATE TABLE "item_catalog" (
  "item_id" bigint PRIMARY KEY,
  "item_type" item_type,
  "name" varchar,
  "variant_name" varchar,
  "sell_price" decimal(10,2),
  "unit" unit_type,
  "unit_per_package" decimal(10,2),
  "tracking_mode" tracking_mode,
  "restock_threshlod" decimal(10,2)
);

CREATE TABLE "stock_movement" (
  "created_at" timestamp DEFAULT (now()),
  "item_id" bigint,
  "movement_type" stock_movement_type,
  "qty" decimal(10,2),
  "sell_invoice_id" bigint,
  "purchase_invoice_id" bigint,
  "note" varchar,
  "expired_at" timestamp,
  PRIMARY KEY ("created_at", "item_id")
);

CREATE TABLE "supplier" (
  "supplier_id" bigint PRIMARY KEY,
  "name" varchar,
  "phone" varchar(10),
  "address" varchar,
  "note" varchar
);

CREATE TABLE "purchase_invoice" (
  "purchase_invoice_id" bigint PRIMARY KEY,
  "supplier_id" bigint,
  "issue_date" datetime,
  "total_amount" decimal(10,2),
  "note" varchar
);

CREATE TABLE "treatment_recipe" (
  "treatment_id" bigint,
  "item_id" bigint,
  "qty_per_session" decimal(10,2),
  "sell_price" decimal(10,2),
  "note" varchar,
  PRIMARY KEY ("treatment_id", "item_id")
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

CREATE TABLE "promotion_benefit" (
  "promotion_benefit_id" bigint PRIMARY KEY,
  "promotion_id" bigint NOT NULL,
  "benefit_type" promotion_benefit_type,
  "target_scope" promotion_target_scope,
  "target_item_id" bigint,
  "value_percent" decimal(10,2),
  "value_amount" decimal(10,2),
  "free_item_id" bigint,
  "free_qty_base_unit" decimal(10,2),
  "note" varchar
);

CREATE TABLE "promotion_redemption" (
  "promotion_redemption_id" bigint PRIMARY KEY,
  "promotion_id" bigint NOT NULL,
  "sell_invoice_id" bigint NOT NULL,
  "customer_id" bigint NOT NULL,
  "coupon_code_used" varchar(50),
  "discount_total" decimal(10,2) DEFAULT 0,
  "wallet_credit_total" decimal(10,2) DEFAULT 0,
  "redeemed_at" timestamp DEFAULT (now())
);

CREATE TABLE "promotion_condition_group" (
  "condition_group_id" bigint PRIMARY KEY,
  "promotion_id" bigint NOT NULL,
  "sort_order" int NOT NULL DEFAULT 1
);

CREATE TABLE "promotion_condition_rule" (
  "condition_rule_id" bigint PRIMARY KEY,
  "condition_group_id" bigint NOT NULL,
  "rule_type" promotion_rule_type NOT NULL,
  "op" promotion_rule_op NOT NULL,
  "amount_value" decimal(10,2),
  "item_id" bigint,
  "qty_base_unit" decimal(10,2),
  "text_value" varchar(100)
);

CREATE TABLE "sell_invoice_promotion_line" (
  "sell_invoice_promotion_line_id" bigint PRIMARY KEY,
  "sell_invoice_id" bigint NOT NULL,
  "sell_invoice_item_id" bigint,
  "promotion_redemption_id" bigint,
  "promotion_id" bigint NOT NULL,
  "promotion_benefit_id" bigint,
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

-- FOREIGN KEYS
ALTER TABLE "promotion_benefit" ADD FOREIGN KEY ("promotion_id") REFERENCES "promotion" ("promotion_id");

ALTER TABLE "promotion_redemption" ADD FOREIGN KEY ("promotion_id") REFERENCES "promotion" ("promotion_id");

ALTER TABLE "promotion_condition_group" ADD FOREIGN KEY ("promotion_id") REFERENCES "promotion" ("promotion_id");

ALTER TABLE "promotion_condition_rule" ADD FOREIGN KEY ("condition_group_id") REFERENCES "promotion_condition_group" ("condition_group_id");

ALTER TABLE "sell_invoice_promotion_line" ADD FOREIGN KEY ("sell_invoice_id") REFERENCES "sell_invoice" ("sell_invoice_id");

ALTER TABLE "sell_invoice_promotion_line" ADD FOREIGN KEY ("promotion_redemption_id") REFERENCES "promotion_redemption" ("promotion_redemption_id");

ALTER TABLE "sell_invoice_promotion_line" ADD FOREIGN KEY ("promotion_id") REFERENCES "promotion" ("promotion_id");

ALTER TABLE "sell_invoice_promotion_line" ADD FOREIGN KEY ("promotion_benefit_id") REFERENCES "promotion_benefit" ("promotion_benefit_id");

ALTER TABLE "payment" ADD FOREIGN KEY ("sell_invoice_id") REFERENCES "sell_invoice" ("sell_invoice_id");

ALTER TABLE "sell_invoice" ADD FOREIGN KEY ("customer_id") REFERENCES "customer" ("customer_id");

ALTER TABLE "wallet_movement" ADD FOREIGN KEY ("customer_id") REFERENCES "customer" ("customer_id");

ALTER TABLE "sell_invoice_item" ADD FOREIGN KEY ("sell_item_id") REFERENCES "item_catalog" ("item_id");

ALTER TABLE "stock_movement" ADD FOREIGN KEY ("item_id") REFERENCES "item_catalog" ("item_id");

ALTER TABLE "sell_invoice_item" ADD FOREIGN KEY ("sell_invoice_id") REFERENCES "sell_invoice" ("sell_invoice_id");

ALTER TABLE "purchase_invoice" ADD FOREIGN KEY ("purchase_invoice_id") REFERENCES "stock_movement" ("purchase_invoice_id");

ALTER TABLE "purchase_invoice" ADD FOREIGN KEY ("supplier_id") REFERENCES "supplier" ("supplier_id");

ALTER TABLE "stock_movement" ADD FOREIGN KEY ("sell_invoice_id") REFERENCES "sell_invoice" ("sell_invoice_id");

ALTER TABLE "treatment_recipe" ADD FOREIGN KEY ("item_id") REFERENCES "item_catalog" ("item_id");

ALTER TABLE "promotion_redemption" ADD FOREIGN KEY ("sell_invoice_id") REFERENCES "sell_invoice" ("sell_invoice_id");