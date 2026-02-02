-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.appointment (
  appointment_time timestamp without time zone NOT NULL,
  appointment_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  customer_id bigint,
  appointment_status USER-DEFINED NOT NULL DEFAULT 'INCOMPLETE'::"APPOINTMENT_STATUS",
  CONSTRAINT appointment_pkey PRIMARY KEY (appointment_id),
  CONSTRAINT appointment_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id)
);
CREATE TABLE public.conversations (
  conversation_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (conversation_id)
);
CREATE TABLE public.customer (
  customer_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  customer_code character varying UNIQUE,
  full_name character varying,
  nickname character varying,
  phone character varying,
  date_of_birth date,
  member_wallet_remain numeric DEFAULT '0'::numeric,
  gender USER-DEFINED,
  CONSTRAINT customer_pkey PRIMARY KEY (customer_id)
);
CREATE TABLE public.daily_stock (
  stock_date date NOT NULL,
  item_id bigint NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  CONSTRAINT daily_stock_pkey PRIMARY KEY (stock_date, item_id),
  CONSTRAINT daily_stock_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_catalog(item_id)
);
CREATE TABLE public.item_catalog (
  item_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sku character varying UNIQUE,
  name character varying,
  variant_name character varying,
  sell_price numeric DEFAULT '0'::numeric,
  unit USER-DEFINED,
  unit_per_package numeric,
  description character varying,
  current_qty numeric DEFAULT '0'::numeric,
  item_type USER-DEFINED,
  restock_threshold numeric DEFAULT '0'::numeric,
  CONSTRAINT item_catalog_pkey PRIMARY KEY (item_id)
);
CREATE TABLE public.messages (
  message_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  conversation_id bigint NOT NULL,
  role USER-DEFINED NOT NULL,
  content text NOT NULL,
  token_count integer,
  model text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(conversation_id)
);
CREATE TABLE public.promotion (
  promotion_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  code character varying UNIQUE,
  name character varying,
  description character varying,
  is_stackable boolean DEFAULT false,
  start_at timestamp without time zone,
  end_at timestamp without time zone,
  is_active boolean DEFAULT true,
  max_redemptions_total integer,
  max_redemptions_per_customer integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT promotion_pkey PRIMARY KEY (promotion_id)
);
CREATE TABLE public.promotion_benefit (
  promotion_benefit_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  promotion_id bigint NOT NULL,
  benefit_type USER-DEFINED,
  target_scope USER-DEFINED,
  target_item_id bigint,
  value_percent numeric,
  value_amount numeric,
  free_item_id bigint,
  free_qty_base_unit numeric,
  CONSTRAINT promotion_benefit_pkey PRIMARY KEY (promotion_benefit_id),
  CONSTRAINT promotion_benefit_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotion(promotion_id)
);
CREATE TABLE public.promotion_condition_group (
  condition_group_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  promotion_id bigint NOT NULL,
  sort_order integer NOT NULL DEFAULT 1,
  CONSTRAINT promotion_condition_group_pkey PRIMARY KEY (condition_group_id),
  CONSTRAINT promotion_condition_group_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotion(promotion_id)
);
CREATE TABLE public.promotion_condition_rule (
  condition_rule_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  condition_group_id bigint NOT NULL,
  rule_type USER-DEFINED NOT NULL,
  op USER-DEFINED NOT NULL,
  amount_value numeric,
  item_id bigint,
  qty_base_unit numeric,
  text_value character varying,
  CONSTRAINT promotion_condition_rule_pkey PRIMARY KEY (condition_rule_id),
  CONSTRAINT promotion_condition_rule_condition_group_id_fkey FOREIGN KEY (condition_group_id) REFERENCES public.promotion_condition_group(condition_group_id)
);
CREATE TABLE public.promotion_redemption (
  promotion_redemption_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  promotion_id bigint NOT NULL,
  sell_invoice_id bigint NOT NULL,
  customer_id bigint NOT NULL,
  coupon_code_used character varying,
  discount_total numeric DEFAULT 0,
  wallet_credit_total numeric DEFAULT 0,
  redeemed_at timestamp without time zone DEFAULT now(),
  CONSTRAINT promotion_redemption_pkey PRIMARY KEY (promotion_redemption_id),
  CONSTRAINT promotion_redemption_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotion(promotion_id),
  CONSTRAINT promotion_redemption_sell_invoice_id_fkey FOREIGN KEY (sell_invoice_id) REFERENCES public.sell_invoice(sell_invoice_id),
  CONSTRAINT promotion_redemption_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id)
);
CREATE TABLE public.purchase_invoice (
  purchase_invoice_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  purchase_no character varying UNIQUE,
  supplier_id bigint,
  issue_at timestamp without time zone,
  total_amount numeric,
  CONSTRAINT purchase_invoice_pkey PRIMARY KEY (purchase_invoice_id),
  CONSTRAINT purchase_invoice_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier(supplier_id)
);
CREATE TABLE public.purchase_invoice_item (
  purchase_invoice_id bigint NOT NULL,
  item_id bigint NOT NULL,
  qty integer,
  purchase_price_per_unit numeric,
  expire_date date,
  CONSTRAINT purchase_invoice_item_pkey PRIMARY KEY (item_id, purchase_invoice_id),
  CONSTRAINT purchase_invoice_item_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id) REFERENCES public.purchase_invoice(purchase_invoice_id),
  CONSTRAINT purchase_invoice_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_catalog(item_id)
);
CREATE TABLE public.sell_invoice (
  sell_invoice_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  invoice_no character varying UNIQUE,
  customer_id bigint,
  issue_at timestamp without time zone,
  total_amount numeric,
  discount_amount numeric,
  final_amount numeric,
  status USER-DEFINED,
  CONSTRAINT sell_invoice_pkey PRIMARY KEY (sell_invoice_id),
  CONSTRAINT sell_invoice_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id)
);
CREATE TABLE public.sell_invoice_item (
  item_id bigint NOT NULL,
  sell_invoice_id bigint NOT NULL,
  description character varying,
  qty integer,
  total_price numeric,
  CONSTRAINT sell_invoice_item_pkey PRIMARY KEY (item_id, sell_invoice_id),
  CONSTRAINT sell_invoice_item_sell_invoice_id_fkey FOREIGN KEY (sell_invoice_id) REFERENCES public.sell_invoice(sell_invoice_id),
  CONSTRAINT sell_invoice_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_catalog(item_id)
);
CREATE TABLE public.stock_movement (
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  item_id bigint NOT NULL,
  movement_type USER-DEFINED,
  qty integer,
  sell_invoice_id bigint,
  purchase_invoice_id bigint,
  CONSTRAINT stock_movement_pkey PRIMARY KEY (created_at, item_id),
  CONSTRAINT stock_movement_sell_invoice_id_fkey FOREIGN KEY (sell_invoice_id) REFERENCES public.sell_invoice(sell_invoice_id),
  CONSTRAINT stock_movement_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id) REFERENCES public.purchase_invoice(purchase_invoice_id),
  CONSTRAINT stock_movement_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_catalog(item_id)
);
CREATE TABLE public.treatment (
  treatment_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying,
  description character varying,
  image_obj_key text,
  category text,
  price bigint,
  CONSTRAINT treatment_pkey PRIMARY KEY (treatment_id)
);
CREATE TABLE public.treatment_recipe (
  treatment_id bigint NOT NULL,
  item_id bigint NOT NULL,
  qty_per_session numeric DEFAULT '1'::numeric,
  sell_price numeric,
  description character varying,
  CONSTRAINT treatment_recipe_pkey PRIMARY KEY (treatment_id, item_id),
  CONSTRAINT treatment_recipe_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatment(treatment_id),
  CONSTRAINT treatment_recipe_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_catalog(item_id)
);
CREATE TABLE public.treatment_session (
  treatment_id bigint NOT NULL,
  sell_invoice_id bigint NOT NULL,
  customer_id bigint,
  session_date date NOT NULL,
  session_time time,
  age_at_session integer,
  note character varying,
  session_time time without time zone,
  CONSTRAINT treatment_session_pkey PRIMARY KEY (treatment_id, sell_invoice_id),
  CONSTRAINT treatment_session_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatment(treatment_id),
  CONSTRAINT treatment_session_sell_invoice_id_fkey FOREIGN KEY (sell_invoice_id) REFERENCES public.sell_invoice(sell_invoice_id),
  CONSTRAINT treatment_session_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id)
);