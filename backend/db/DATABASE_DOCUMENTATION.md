# Database Overview (refine-haus-clinic)

This document summarizes what each table stores, what it does, and how the main entities are created and connected. Source: `backend/db/schema.sql`.

## Enum types
- item_type: MEDICINE, MEDICAL_TOOL.
- invoice_status: UNPAID, PARTIAL, PAID.
- payment_method: CASH, CARD, MEMBER_WALLET.
- tracking_mode: PER_SESSION, WITHDRAW.
- unit_type: U, CC, PIECE.
- stock_movement_type: OPENING_BALANCE, PURCHASE_IN, USE_FOR_PROMOTION, USE_FOR_TREATMENT, WASTE, ADJUST.
- promotion_benefit_type: PERCENT_DISCOUNT, AMOUNT_DISCOUNT, FREE_ITEM, WALLET_CREDIT.
- promotion_target_scope: INVOICE_TOTAL, LINE_ITEM.
- promotion_rule_type: MIN_SPEND, HAS_ITEM, MIN_QTY_ITEM, NEW_CUSTOMER_ONLY, MIN_WALLET_TOPUP.
- promotion_rule_op: EQ, GTE, LTE.
- invoice_promo_line_type: DISCOUNT, FREE_ITEM, WALLET_CREDIT.
- chat_role: USER, SYSTEM.

## Table dictionary

### Chat
- conversations: Chat session container with optional `title`, plus `created_at`/`updated_at`. `updated_at` is touched when a new message is added.
- messages: Individual chat turns for a conversation. `role` is USER or SYSTEM, `content` is the text, and `token_count`/`model` are optional metadata. Deleting a conversation cascades to its messages.

### Customer and wallet
- customer: Customer profile and wallet balance (`member_wallet_remain`). `customer_code` is auto-generated as `C-000001`. Age should be derived at query time from `date_of_birth`.
- wallet_movement: Wallet ledger per customer. Each row is a wallet change at `created_at`, and updates `member_wallet_remain`.

### Item catalog and stock
- item_group: Groups variants of the same item (same unit) for stock reporting. `group_code` is auto-generated (MED-000123 / TOOL-000123) and `current_qty` is auto-calculated from stock movements.
- daily_stock: Daily snapshot of item_group stock totals (created by a scheduled job).
- item_catalog: Master list of items that can be sold or consumed. Stores unit, tracking mode, price, and restock threshold. `sku` is auto-generated as `<item_group_id>-<item_id>-<variant>`.
- stock_movement: Inventory ledger. Each movement records item, type, quantity, and optional links to sell or purchase invoices. Sales use negative qty, purchases use positive qty.
- treatment: Treatment/service master list.
- treatment_recipe: Items consumed per treatment (`treatment_id` + `item_id`) and their qty per session.
 
Triggers keep `item_group.current_qty` in sync based on `stock_movement.qty * unit_per_package`.
Daily job stores snapshots in `daily_stock` using movements up to the snapshot date (including OPENING_BALANCE).

### Procurement
- supplier: Supplier profile and contact info. `supplier_code` is auto-generated as `S-000001`.
- purchase_invoice: Supplier purchase order header with total amount. `purchase_no` is the human-friendly id.
- purchase_invoice_item: Line items for a purchase invoice with quantity and purchase price per unit; triggers create `stock_movement`.

### Sales and payment
- sell_invoice: Sales invoice header for a customer with totals and status. `invoice_no` is auto-generated as `INV-<customer_id>-<YYYY>-<sell_invoice_id>`.
- sell_invoice_item: Line items on a sales invoice. Each line references an item and a qty/total price; triggers update totals and create stock movements.
- payment: Payment events for a sales invoice with method and amounts (customer paid, card fee, clinic amount). `receipt_no` is auto-generated as `<invoice_no>-<seq>`.

### Promotions
- promotion: Promotion master (code, name, time window, stackability).
- promotion_benefit: Benefits linked to a promotion (discounts, free items, wallet credit).
- promotion_condition_group: OR groups for promotion conditions.
- promotion_condition_rule: AND rules inside a group (min spend, has item, qty thresholds).
- promotion_redemption: When a promotion is used on a sale; links promotion, invoice, and customer.
- sell_invoice_promotion_line: How a promotion affects a specific invoice or line item (discount, free item, wallet credit). Trigger enforces only one non-stackable promotion per invoice.

## Relationships (high level)
- item_group 1..n item_catalog.
- item_group 1..n daily_stock.
- customer 1..n sell_invoice, wallet_movement, promotion_redemption.
- sell_invoice 1..n sell_invoice_item, payment, sell_invoice_promotion_line.
- item_catalog 1..n sell_invoice_item, stock_movement, treatment_recipe, promotion_benefit (target/free item).
- supplier 1..n purchase_invoice.
- purchase_invoice 1..n purchase_invoice_item, stock_movement.
- promotion 1..n promotion_benefit, promotion_condition_group, promotion_redemption.
- promotion_condition_group 1..n promotion_condition_rule.
- Most foreign keys use `ON DELETE CASCADE` to prevent orphans.

## Entity creation flow (typical)

### 1) Setup data
1. Create item groups in `item_group`.
2. Create item catalog entries in `item_catalog`.
3. Create suppliers in `supplier`.
4. Create treatments in `treatment` and define recipes in `treatment_recipe` (optional).
5. Define promotions in `promotion`, then add rules (`promotion_condition_group`, `promotion_condition_rule`) and benefits (`promotion_benefit`).

### 2) Procurement and stock-in
1. Create a `purchase_invoice` for a supplier.
2. Add `purchase_invoice_item` rows for line items and quantities.
3. Triggers create `stock_movement` rows with `movement_type = PURCHASE_IN`.

### 3) Customer and wallet
1. Create `customer`.
2. When wallet is topped up or used, insert `wallet_movement` rows; triggers update `customer.member_wallet_remain`.

### 4) Sales (invoice, items, payment)
1. Create `sell_invoice` for a customer (status starts UNPAID).
2. Add `sell_invoice_item` rows for each sold item.
3. Apply promotions (optional):
   - Create `promotion_redemption` for the invoice.
   - Add `sell_invoice_promotion_line` rows for discounts/free items/wallet credits.
4. Collect payment:
   - Insert `payment` rows for each payment event based on the amount due (typically `sell_invoice.final_amount`).
   - Triggers update `sell_invoice.status` (PARTIAL or PAID).
5. Reduce inventory:
   - Triggers create `stock_movement` rows with `movement_type = USE_FOR_TREATMENT` (negative qty) or other relevant types.

### 5) Treatment usage (if used)
1. Create a `treatment` and define a `treatment_recipe` mapping treatments to required items and qty per session.
2. When a treatment session occurs, create `stock_movement` rows based on the recipe.

### 6) Chat feature (if enabled)
1. Create a `conversations` row when a chat starts.
2. Insert `messages` for each USER/SYSTEM turn; triggers update `conversations.updated_at`.

## Notes and assumptions
- Age is derived from `customer.date_of_birth` (no stored `age` field).
