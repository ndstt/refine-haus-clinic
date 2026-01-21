# Table Attributes (refine-haus-clinic)

This file explains the purpose of each column in every table. Source: `backend/db/schema.sql`.

## conversations
- id: Primary key for the chat session.
- title: Optional title for the conversation.
- created_at: When the conversation was created.
- updated_at: When the conversation was last used (updated by message insert trigger).

## messages
- id: Primary key for a message.
- conversation_id: FK to conversations; the chat this message belongs to.
- role: USER or SYSTEM.
- content: Message text.
- token_count: Token usage metadata (optional).
- model: Model name metadata (optional).
- created_at: When the message was created.

## customer
- customer_id: Primary key.
- customer_code: Human-friendly code like C-000001 (auto-generated).
- full_name: Customer full name.
- nickname: Customer nickname.
- phone: Phone number.
- date_of_birth: Date of birth.
- member_wallet_remain: Current wallet balance (synced from wallet_movement).

## supplier
- supplier_id: Primary key.
- supplier_code: Human-friendly code like S-000001 (auto-generated).
- description: Notes about supplier.
- name: Supplier name.
- phone: Supplier phone.
- address: Supplier address.

## item_catalog
- item_id: Primary key.
- sku: Human-friendly item code like I0-000123-name-variant (auto-generated; 0=MEDICINE, 1=MEDICAL_TOOL).
- item_type: MEDICINE or MEDICAL_TOOL.
- name: Item name.
- variant_name: Variant label (size, strength, etc.).
- sell_price: Selling price per unit.
- unit: U, CC, PIECE.
- unit_per_package: Units per package (if applicable).
- tracking_mode: PER_SESSION or WITHDRAW.
- restock_threshlod: Restock threshold (typo kept as schema name).
- description: Item notes.

## promotion
- promotion_id: Primary key.
- code: Optional coupon code.
- name: Promotion name.
- description: Optional description.
- apply_mode: AUTO or COUPON.
- priority: Priority ordering (lower runs first if used).
- is_stackable: Whether it can stack with others.
- start_at: Start time (optional).
- end_at: End time (optional).
- is_active: Active flag.
- max_redemptions_total: Max total redemptions (optional).
- max_redemptions_per_customer: Max redemptions per customer (optional).
- created_at: When created.

## purchase_invoice
- purchase_invoice_id: Primary key.
- purchase_no: Human-friendly purchase number.
- supplier_id: FK to supplier.
- issue_date: Issued date/time.
- total_amount: Total amount for the purchase.

## sell_invoice
- sell_invoice_id: Primary key.
- invoice_no: Human-friendly invoice number like INV-000001-2025-000123 (auto-generated).
- customer_id: FK to customer.
- issued_at: Issued date/time.
- total_amount: Sum of sell_invoice_item totals (trigger-updated).
- discount_amount: Sum of discount lines (trigger-updated).
- final_amount: total_amount + discount_amount (trigger-updated).
- status: UNPAID, PARTIAL, PAID.

## wallet_movement
- created_at: When the wallet change happened.
- customer_id: FK to customer.
- amount: Positive for top-up, negative for spend.

## sell_invoice_item
- sell_item_id: FK to item_catalog.
- sell_invoice_id: FK to sell_invoice.
- description: Line description.
- qty: Quantity sold.
- total_price: Line total.

## payment
- payment_time: When payment occurred.
- sell_invoice_id: FK to sell_invoice.
- receipt_no: Human-friendly receipt number like <invoice_no>-<seq> (auto-generated).
- method: CASH, CARD, MEMBER_WALLET.
- amount_customer_paid: Amount paid by customer.
- card_fee: Card fee (if card used).
- clinic_amount: Net clinic amount.

## purchase_invoice_item
- purchase_item_id: FK to purchase_invoice (schema uses this as a reference).
- purchase_invoice_id: Purchase invoice id (as stored in schema).
- qty: Quantity purchased.
- purchase_price_per_unit: Unit purchase price.

## stock_movement
- created_at: When the movement was recorded.
- item_id: FK to item_catalog.
- movement_type: OPENING_BALANCE, PURCHASE_IN, USE_FOR_PROMOTION, USE_FOR_TREATMENT, WASTE, ADJUST.
- qty: Quantity moved (positive in, negative out).
- sell_invoice_id: FK to sell_invoice (optional).
- purchase_invoice_id: FK to purchase_invoice (optional).
- expired_at: Expiration date (optional).

## treatment_recipe
- treatment_id: Treatment/service id (not defined in schema).
- item_id: FK to item_catalog.
- qty_per_session: Quantity used per session.
- sell_price: Selling price per session.
- description: Notes.

## promotion_benefit
- promotion_benefit_id: Primary key.
- promotion_id: FK to promotion.
- benefit_type: PERCENT_DISCOUNT, AMOUNT_DISCOUNT, FREE_ITEM, WALLET_CREDIT.
- target_scope: INVOICE_TOTAL or LINE_ITEM.
- target_item_id: Item targeted (nullable).
- value_percent: Percent discount (nullable).
- value_amount: Amount discount or wallet credit (nullable).
- free_item_id: Free item (nullable).
- free_qty_base_unit: Free quantity in base units (nullable).

## promotion_condition_group
- condition_group_id: Primary key.
- promotion_id: FK to promotion.
- sort_order: Order of OR groups.

## promotion_condition_rule
- condition_rule_id: Primary key.
- condition_group_id: FK to promotion_condition_group.
- rule_type: MIN_SPEND, HAS_ITEM, MIN_QTY_ITEM, NEW_CUSTOMER_ONLY, MIN_WALLET_TOPUP.
- op: EQ, GTE, LTE.
- amount_value: Numeric threshold (nullable).
- item_id: Target item (nullable).
- qty_base_unit: Quantity threshold (nullable).
- text_value: Text value (nullable).

## promotion_redemption
- promotion_redemption_id: Primary key.
- promotion_id: FK to promotion.
- sell_invoice_id: FK to sell_invoice.
- customer_id: FK to customer.
- coupon_code_used: Coupon code used (optional).
- discount_total: Total discount amount.
- wallet_credit_total: Total wallet credit amount.
- redeemed_at: When redeemed.

## sell_invoice_promotion_line
- sell_invoice_promotion_line_id: Primary key.
- sell_invoice_id: FK to sell_invoice.
- sell_invoice_item_id: FK to sell_invoice_item (nullable).
- promotion_redemption_id: FK to promotion_redemption (nullable).
- promotion_id: FK to promotion.
- promotion_benefit_id: FK to promotion_benefit (nullable).
- line_type: DISCOUNT, FREE_ITEM, WALLET_CREDIT.
- amount: Discount amount (negative value).
- free_item_id: Free item (nullable).
- free_qty_base_unit: Free quantity (nullable).
- stock_movement_id: Stock movement reference (nullable).
- wallet_credit_amount: Wallet credit amount (nullable).
- wallet_movement_id: Wallet movement reference (nullable).
- description: Optional description.
- created_at: Created time.
