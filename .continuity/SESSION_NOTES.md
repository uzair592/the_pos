# Session Notes

## Goals
- Restructure purchasing, inventory, recipe management, and FIFO costing to match real-world restaurant workflows.
- Enable single-step purchase workflow with on-the-fly inventory item and supplier creation.
- Ensure strict zero automatic unit conversions (preserve purchased and entered units exactly).
- Create separate FIFO inventory batches per purchase preserving purchase ID, received date, unit, unit cost, and remaining quantity.
- Implement FIFO batch inspection in Inventory Management with expandable lot sub-tables and dedicated FIFO Valuation Report tab.
- Automate order recipe FIFO ingredient deductions and order-by-order COGS tracking.
- Test and verify the user's exact Dough (3kg @ 150 + 5kg @ 200) and Pizza (0.25kg dough) 16 & 8 pizza sales FIFO lifecycle end-to-end.

## Blockers
- None. 113/113 backend tests pass across 14 test files, frontend production build is clean (0 errors), and dev servers are operational.

## Key Decisions
- Decision 62: Restructured Purchasing, Inventory, Recipe & FIFO Costing System:
  1. Simplified Purchase System & Auto-Creation:
     - Allows entering supplier name directly (auto-created if not existing).
     - Allows entering raw item name directly: if not in inventory, automatically creates the ingredient with proper SKU and unit, creates branch stock, and activates FIFO batch.
     - Single-step item entry table with live totals, purchase date picker, and optional invoice number.
  2. Zero Automatic Unit Conversions:
     - No automatic multipliers between KG/grams, cartons/pieces, or liters/ml.
     - Quantities purchased and used in recipes are preserved exactly as entered.
  3. FIFO Batch Management & Valuation Report:
     - Every purchase creates an independent `inventory_batches` record with `purchase_id`, `unit`, `supplier_name`, `received_at`, and `unit_cost`.
     - In `InventoryManagement.tsx`, updated the Stock table with columns: Raw Ingredient, Available Stock, Unit, Total Stock Value, Latest Purchase Price, Active FIFO Lots (with click-to-expand sub-tables showing lot queue order, received date, remaining qty, unit cost, and remaining value), Stock Status, and Actions (View FIFO Batches, View Stock Ledger, Adjust Stock, Edit, Delete).
     - Built dedicated `VALUATION` tab rendering executive KPI cards (Total FIFO Valuation, Tracked Raw Items, Active FIFO Lots, Avg Value / Item) and comprehensive item-by-item batch valuation breakdown with search and category filters.
  4. End-to-End Dough & Pizza Acceptance Test:
     - Created `backend/test/fifo_dough_recipe_e2e.test.ts` implementing the user's exact specification:
       - Purchase 1: Dough 3 KG @ Rs. 150/KG (auto-created Dough and Supplier).
       - Purchase 2: Dough 5 KG @ Rs. 200/KG (reused Dough, Batch 1 = 3 KG @ 150, Batch 2 = 5 KG @ 200, Total Stock = 8 KG, Total Value = Rs. 1450).
       - Recipe: Chicken Pizza consuming 0.25 KG Dough per pizza.
       - Sale 1: 16 Pizzas (deducted 4 KG: 3 KG from Batch 1 @ 150 + 1 KG from Batch 2 @ 200 -> COGS = Rs. 650; Batch 1 exhausted, Batch 2 has 4 KG remaining @ 200 -> stock value = Rs. 800).
       - Sale 2: 8 Pizzas (deducted 2 KG from Batch 2 @ 200 -> COGS = Rs. 400; Batch 2 has 2 KG remaining @ 200 -> stock value = Rs. 400).
       - Valuation: Total value = Rs. 400 across 1 active batch.
     - Test passes 6/6.
  5. Verification & Testing:
     - Backend test suite: 113/113 tests passed across all 14 test suites.
     - Frontend build (`tsc && vite build`): completed in 17s with 0 errors.

- Decision 56: Architecture Correction — Online-Only Web-Based SaaS POS & Multi-Device Access:
  1. Strict Online-Only Architecture:
     - Central PostgreSQL and Express API are the single authoritative source of truth.
     - Fully eliminated offline queue processing (`localStorage.pos_offline_orders`) and offline optimistic orders.
     - Built global connection loss detection (`ConnectionStatusBar.tsx` and API network error interception) that warns the user and strictly blocks server-dependent mutations when disconnected.
     - On connection restoration, fresh central state is fetched.
  2. Concurrent Device Session Limit Enforcement:
     - Implemented `uq_active_device_session` constraint on `active_device_sessions (tenant_id, device_fingerprint)`.
     - In `POST /api/auth/login`, calls `verifyAndEnforceConcurrentLimit`. Rejects logins attempting to exceed tenant `max_devices` with HTTP 403 `CONCURRENT_LIMIT_REACHED` and detailed session usage payload.
     - Supports seamless reactivation of previously logged out sessions via `ON CONFLICT (tenant_id, device_fingerprint) DO UPDATE`.
     - Heartbeat mechanism (`POST /api/auth/heartbeat`, 45-second frontend pulse) keeps active terminals `ONLINE`. Terminals without a heartbeat in 3 minutes are automatically marked `OFFLINE`.
     - Explicit logout (`POST /api/auth/logout`) and force-revocation immediately free active slots.
  3. Reliability, Concurrency & Idempotency:
     - Server-side idempotency keys (`Idempotency-Key` header) prevent duplicate orders/payments on retry or slow connections.
     - ACID database transactions with automatic rollback guarantee data integrity.
  4. Multi-Terminal Real-Time Sync:
     - High-speed change polling and WebSocket event dispatching (`/api/sync/events`) ensure immediate sync across Desktop 1, Desktop 2, Laptop, Waiter Tablet, Kitchen Terminal, and Manager devices.
  5. Verification & Testing:
     - Automated test suite `backend/test/online_saas_multidevice.test.ts` (17 tests) covering all authentication, multi-device limits, slot liberation, real-time sync, KDS status updates, and transaction rollback.
     - Monorepo vitest suite: 102/102 tests passed across 12 test files.
     - QA simulation suite: 38/38 checks passed with 0 failures.
     - Frontend production build passed with 0 errors.

- Decision 55: Professional Top Header Redesign, 4 Primary Action Buttons & Comprehensive "Add More" Quick-Action System:
  1. Elimination of Duplicate Actions:
     - Stripped out all redundant and duplicated buttons (`Workspace Hub`, `Launch POS`, `Kitchen Display`, `Orders Hub`, `Open POS Terminal`, `Kitchen Screen`) from the top navigation bar and dashboard overview without deleting underlying pages or routes.
  2. Four Primary Action Buttons:
     - `POS Terminal` (`/pos`, Alt+S): Most prominent emerald gradient action button with POS terminal icon and shortcut badge.
     - `Orders` (`/app/orders`): Hub navigation with active/in-flight order count notification badge.
     - `Kitchen Display` (`/kds`): Dedicated kitchen station route with pending tickets badge, conditionally rendered by tenant subscription entitlements (`hasFeature(FeatureKey.KDS)`).
     - `Add More`: Comprehensive categorized dropdown containing all restaurant operational quick actions.
  3. Structured "Add More" Dropdown Categories & Backend Integration:
     - A. Sales & Order Operations: New Sale / POS Terminal (Alt+S), Sale Order / Advance Order modal (Alt+F), Customer Payment-In modal (Alt+I -> `POST /api/customers/:id/payment`), Sale Return / Refund modal (Alt+R), Estimate / Quotation modal (Alt+M), Delivery Challan modal (Alt+D).
     - B. Menu & Product Management: Create Menu Item (`/app/menu?action=new-product`), Create Menu Category (`/app/menu?action=new-category`), Create Deal / Combo Builder modal, Create Modifier / Add-on (`/app/menu?action=new-modifier`), Manage Menu Availability modal.
     - C. Purchase & Supplier Operations: Add Purchase / Purchase Bill (`/app/purchases?action=new-purchase`, Alt+P), Purchase Order modal (Alt+G), Purchase Return modal (Alt+L -> `POST /api/inventory/purchases/return`), Supplier Payment-Out modal (Alt+O -> `POST /api/inventory/suppliers/:id/payment`), Add Supplier modal (`POST /api/inventory/suppliers`).
     - D. Inventory Operations: Add Ingredient (`/app/inventory?action=new-ingredient`), Stock Adjustment modal (`POST /api/inventory/stock-adjustment`), Stock Transfer modal (`POST /api/inventory/transfer`), View Low Stock (`/app/inventory?tab=low_stock`).
     - E. Finance & Expense Operations: Record Expense modal (`POST /api/financial/expenses`), Cash In / Cash Out drawer movement modal (`POST /api/cash-bank/transactions`), Daybook / Register (`/app/daybook`).
     - F. Customers & Restaurant Operations: Add Customer modal (`POST /api/customers`), Reservation (`/app/orders?tab=reservations&action=new-reservation`), Waitlist (`/app/orders?tab=waitlist&action=new-waitlist`), Manage Tables (`/app/settings?tab=tables`).
  4. Global Utility & Context Integration:
     - Added `GET /api/restaurant/global-search` endpoint querying orders, menu items, ingredients, customers, and suppliers in a single query.
     - Implemented `GlobalSearchModal` with `Ctrl + K` global shortcut listener, entity-type icons, badges, and direct navigation.
     - Implemented `NotificationCenter` popover showing live counts and details for active orders, kitchen tickets, low stock warnings, and reservations with clear/mark-read capabilities.
     - Implemented `KeyboardShortcutsModal` displaying all system keyboard shortcuts organized by Header, POS, and Navigation.
     - Maintained compact Restaurant Context area showing restaurant name, active branch, active currency, user name & role, and live synchronization status indicator.
  5. Verification & Testing:
     - Frontend production build (`tsc && vite build`) passed with 0 errors.
     - Backend test suite: 85/85 tests passed across 11 test files.
     - QA simulation suite: 38/38 checks passed with 0 failures.

- Decision 54: Final Left Sidebar Navigation, Vyapar Accordion Behavior & 7-Section Financial Reports Integration:
  1. Strict Vyapar Accordion Navigation (`Sidebar.tsx`):
     - Enforced single-dropdown accordion state (`openDropdown: string | null`), ensuring opening one menu automatically collapses any previously open menu.
     - Structured strictly into:
       - SALES & ORDERS: POS Billing Terminal (direct, SALE badge, Alt+S), Orders (Accordion: All Orders, Active / Queued, Completed, Reservations, Waitlist), Kitchen Display (direct, pending badge).
       - INVENTORY & ITEMS: Menu Items & Recipes (direct), Purchases & Inward Stock (direct), Ingredients & Inventory (Accordion: Inventory Overview, Ingredients, Stock Movements, Low Stock & Reorder, Stock Adjustments).
       - OPERATIONS: Daybook / Register (direct), Cash & Bank (direct).
       - FINANCE & REPORTS: Financial Reports & P&L (direct), Recipe Costing & Food Cost (direct).
       - SETTINGS & SYSTEM: Staff & Roles (direct), Restaurant Settings (Accordion: General Settings, Floor & Table Management).
     - Added instant Global Navigation Search filtering with clear buttons and smooth keyboard navigation.
     - Preserved collapsed 80px mode with interactive flyout submenus on hover.
  2. Canonical 7-Section Financial Reports & P&L Architecture (`FinancialReports.tsx`):
     - Reorganized navigation tabs to present the canonical 7 reports in exact sequence:
       1. Financial Overview (P&L executive summary, KPIs, sales by product, sales by category)
       2. Sales & Revenue (detailed completed transaction ledger with invoice download)
       3. Bill-Wise Profit & Loss (order-by-order FIFO reconciliation, margins, itemized modal breakdown, and single-bill A4 PDF export)
       4. Daily Profit & Loss (calendar-day FIFO gross profit and margin percentages)
       5. Monthly Profit & Loss (month-over-month performance: Net Sales, FIFO COGS, Operating Expenses, Net Operating Profit, and Net Margin %)
       6. Expense Analysis (OPEX ledger with categorization, branches, and payment methods)
       7. Branch-wise Financial Reports (multi-outlet network comparison: Sales, COGS, Gross Profit, Expenses, Net Profit, and Inventory Valuation)
     - Created backend route `GET /api/financial/reports/monthly-profit-loss`.
     - Wired `GET /api/financial/reports/head-office-summary` directly to Branch-wise comparative reporting.
     - Added `exportMonthlyProfitLossPdf` and `exportBranchFinancialReportPdf` to `pdfExport.ts`.
  3. Complete Verification:
     - Frontend build (`tsc && vite build`) passed with 0 errors.
     - Backend test suite: 85/85 tests passed across all 11 test suites.
     - QA simulation suite: 38/38 checks passed with 0 failures.

- Decision 53: Comprehensive Operational Fixes, Inward Stock FIFO Lots, Table Layouts, Reservations/Waitlist Seating, and Vyapar-Inspired Sidebar Navigation:
  1. Order & Kitchen Display Synchronization:
     - Resolved order visibility gap where KDS tickets existed without visible dashboard orders by including all in-flight operational statuses (NEW, PENDING, QUEUED, CONFIRMED, ACCEPTED, PREPARING, READY, SERVED, OUT_FOR_DELIVERY, ON_HOLD).
     - Added kitchen_status and latest_kot_number to /api/orders/active and /api/orders/:id, rendering live KOT badges across Dashboard, Recent Orders, and Active Orders.
     - Synchronized order checkout/settlement to update associated kitchen tickets to SERVED.
  2. Inward Purchases Immediate Stock & FIFO Lot Conversion:
     - Upgraded POST /api/inventory/purchases with receiveNow: true to automatically convert purchase units to base units (e.g. 25 KG -> 25,000 G) and post directly to branch stock and active FIFO batches.
     - Created POST /api/inventory/purchases/reconcile enabling safe 1-click reconciliation of historical purchases without duplicate stock addition.
  3. Unified Ingredients & Inventory Workspace (InventoryManagement.tsx):
     - Organized into 7 cohesive tabs: overview (Valuation & KPIs), STOCK (Ingredients table), movements (Complete Stock Ledger), low_stock (Stock Alerts & 1-Click Reorder), BATCHES (FIFO Lots), TRANSFERS (Inter-branch), and RECIPES (Recipe Master).
     - Synced URL parameter ?tab=low_stock and added direct Restock link from Dashboard alerts.
  4. Floor & Table Management (FloorTableManagement.tsx):
     - Relocated under Restaurant Settings -> Floors & Tables (/app/settings?tab=tables).
     - Supports visual grid layouts with drag-and-drop coordinate updates (pos_x, pos_y), geometric shapes (ROUND, RECTANGLE, SQUARE), waiter assignment, capacity, and live occupancy status.
     - Database migrations 013_reservations_waitlist_and_tables.sql and 014_restaurant_tables_timestamps.sql.
  5. Reservations & Waitlist System (ReservationsManagement.tsx & WaitlistManagement.tsx):
     - Relocated directly under Orders Hub (/app/orders?tab=reservations and /app/orders?tab=waitlist).
     - Conflict prevention using PostgreSQL OVERLAPS time window calculations preventing double-booking of dining tables.
     - 1-Click "Seat Customer" converting reservations/waitlist entries to SEATED and marking dining tables as OCCUPIED.
     - Live waitlist queue with automatic sequential numbering, party size, wait timers, and customer notification alerts.
  6. Vyapar-Inspired Hierarchical Sidebar Redesign (Sidebar.tsx):
     - Grouped into SALES & ORDERS, INVENTORY & ITEMS, OPERATIONS, FINANCE & REPORTS, and SETTINGS & SYSTEM.
     - Expandable multi-level tree submenus with localStorage state persistence and auto-expansion based on active routes.
     - Live notification badges polling /api/restaurant/sidebar-badges every 12 seconds for active orders, KDS tickets, low stock, and waitlist.
     - Collapsed mode (80px width) with interactive flyout submenus on hover.
     - Added legacy route redirects (/app/tables -> /app/settings?tab=tables, /app/reservations -> /app/orders?tab=reservations, /app/stock-alerts -> /app/inventory?tab=low_stock, /app/cash-bank -> /app/cash-and-bank).
  7. Rigorous Verification & Tests:
     - 100% frontend production build passed (tsc && vite build in 13.8s).
     - 85/85 Vitest automated test cases passed across all 11 backend test suites, including dedicated operational_bugs_and_modules.test.ts.
     - 38/38 QA simulation suite checks passed.

- Decision 52: Complete Platform Super Admin Panel – Centralized Multi-Tenant Control, Dynamic Concurrency, Backups, Recovery & Operations:
  1. Complete Database Enhancements (`012_platform_super_admin_enhancements.sql`):
     - Enhanced `platform_admins`: added `role`, `permissions`, `phone`, `token_version`.
     - Enhanced `tenants`: added `max_concurrent_devices`, `custom_features`, `deleted_at`, `deletion_reason` for safe soft-deletion/archiving.
     - Created `active_device_sessions`: tracks live concurrent device sessions with real-time heartbeats (`device_fingerprint`, `device_name`, `device_type`, `ip_address`, `os_info`, `status`, `last_heartbeat_at`).
     - Created `restoration_history`: full audit trail for database restore operations with mode, records count, status, and error logs.
     - Created `platform_tickets` & `platform_ticket_messages`: customer support ticketing and reply threading.
     - Created `platform_announcements`: system maintenance, updates, and notice broadcasting.
     - Created `platform_api_keys`: external integration key management with sha256 hashing.
     - Created `platform_settings`: global platform defaults, branding, currency, timezone, trial days, session limits, maintenance mode.
     - Enhanced `subscription_payments`: added `rejection_reason`, `verified_at`, `verified_by_admin_id`, `invoice_pdf_url`.
  2. Enterprise Backup & Transactional Recovery Engine (`backupService.ts`):
     - `generateTenantBackup`: complete relational JSON backup covering all 34 tenant-scoped tables with sanitized staff users.
     - `generateTenantExcelBackup`: generated formatted multi-sheet `.xlsx` workbook (Overview, Profile, Branches, Users, Settings, Categories, Products, Variants, Modifiers, Ingredients, Recipes, FIFO Batches, Stock, Suppliers, Purchases, Orders, Payments, Bank, Expenses, Customers, Devices) via `xlsx` library.
     - `validateBackupPackage`: pre-validation checking SHA-256 checksum integrity, metadata, tenant mapping, schema version, and record count summary.
     - `restoreTenantBackup`: transactional restore with full, selective, and merge modes, pre-restore automatic safety backup, savepoints (`SAVEPOINT row_sp` / `SAVEPOINT clean_sp`) preventing aborted transaction state, and audit logging into `restoration_history`.
  3. Dynamic Multi-Device Concurrency Control (`deviceService.ts`):
     - Separated `registered_devices` (hardware inventory) from `active_device_sessions` (live concurrent active sessions).
     - Solved permanent computer locking: devices dynamically connect, update heartbeats, and if the limit is reached (e.g. 4/4), a fifth device can revoke existing sessions or wait for 5-minute timeout.
     - 1-Click remote force-logout / session revocation (`POST /api/platform/devices/sessions/:sessionId/revoke`).
  4. Platform Management Frontend Pages & Navigation:
     - `PlatformDashboard`: MRR, ARR, active/trial/suspended counts, 12-month revenue bar visualizer, plan distribution, security activity table.
     - `PlatformTenants`: 3-dot contextual menu on each row (View Details, Edit Restaurant Details, Manage Credentials, Change/Extend Plan, Download JSON, Download Excel, Restore from Backup, Suspend/Reactivate, Archive/Delete), live connected device badge (`X / Y Connected`).
     - `PlatformPlans`: full CRUD, tier pricing, max branches/staff/devices limits, feature toggles, subscriber safeguard blocking deletion of active plans.
     - `PlatformPayments`: 3-dot menu, invoice breakdown modal, approve/reject workflow, manual recording.
     - `PlatformBranches`: outlet overview across all tenants, contact details, status toggle.
     - `PlatformDevices`: live status indicators (`ONLINE` green pulse, `IDLE` amber, `OFFLINE`), 1-click Revoke Session.
     - `PlatformBackups`: backup & recovery hub, instant JSON & Excel downloaders, JSON upload pre-validation preview, mode selector, restoration history table.
     - `PlatformUsers`: platform administrator CRUD, RBAC roles, strong password generator, password reset, self-delete safeguard.
     - `PlatformTickets`: customer support helpdesk, status and priority filters, thread viewer, internal notes, reply posting.
     - `PlatformSystemHealth`: live DB connection pool latency, idle/active clients, Node memory heap, CPU specs, 24h error count, auto-refresh.
     - `PlatformAuditLogs`: forensic security audit logs with JSON payload inspector.
     - `PlatformSettings`: branding, support info, default trial/grace/devices, maintenance mode, min POS version, API keys manager.
     - Expanded `Sidebar.tsx` and `App.tsx` routes under `/platform-admin/*`.
  5. Verification & Testing:
     - 100% frontend production build passed (`tsc && vite build` in 15s).
     - 10/10 test suites passed (71/71 tests) in Vitest, including dedicated `platform_super_admin.test.ts`.
     - 38/38 QA simulation suite checks passed.

- Decision 51 (commit b6d3d3a): Fix POS Receipt Printing Data Binding, NaN/Undefined Glitches & Direct Thermal Printing:
  1. Root Cause Resolution for `undefined`, `NaN`, and `Invalid Date`:
     - Identified missing database joins in `/api/orders/active` and `/api/orders/:id/receipt` which omitted `branch_phone`, `branch_address`, and `restaurant_name`.
     - Standardized property naming mismatch between raw Postgres `snake_case` (e.g. `order_number`, `product_name`, `created_at`, `total_price`) and formatters expecting `camelCase` (`orderNumber`, `productName`, `date`, `totalPrice`), preventing `undefined` values and `Number(undefined) -> NaN` calculations.
     - Normalized date handling using Pakistan Standard Time (`Asia/Karachi`) to prevent `"Invalid Date"`.
     - Guaranteed 100% safe numerical parsing (`safeNumber`) so currency values format as `Rs. 1,250.00` and never leak `Rs. NaN`.
  2. Dedicated Thermal Receipt Printing Engine (`frontend/src/utils/receiptPrinter.ts`):
     - Created `normalizeAndValidateReceiptData` with zero-leak guarantees for all order fields, items, modifiers, taxes, and payment lines.
     - Created `generateThermalReceiptHtml` with optimized CSS layouts for both **80mm** (standard 3-inch roll) and **58mm** (compact 2-inch roll) thermal paper widths with clean dashed dividers, item counts, unit prices, discounts, and clear bold totals.
     - Added `*** DUPLICATE / REPRINT RECEIPT ***` header banner for receipts printed from Orders Hub, Daybook, or Dashboard to distinguish reprints from originals.
     - Created `formatReceiptPlainText` for 1-click clean WhatsApp / SMS receipt sharing without corrupted characters.
  3. Elimination of In-App Print Preview Modal:
     - Replaced the screen-blocking in-app `ReceiptModal` popup in POS Terminal, Orders Hub, Daybook, and Dashboard with high-speed direct printing (`executeThermalPrint`).
     - Rendered receipts into a sandboxed, hidden iframe (`#pos-silent-thermal-frame`), invoking the browser/system printer dialog directly in 1 click.
  4. Verification:
     - 100% frontend production build passed (`tsc && vite build`).
     - 63/63 vitest automated backend test cases passed across 9 test suites.
     - 38/38 QA simulation checks passed in `backend/test/qa_simulation_suite.ts`.
     - Pushed to `origin feature/initial-project`.

- Decision 50: Fixed Left Navigation Sidebar, Collapsible Menu & Distinct Background Separation:
  1. Fixed Viewport-Locked Navigation Layout (`App.tsx`):
     - Restructured `RestaurantLayout` and `SuperAdminLayout` from scrolling window containers (`min-h-screen`) into viewport-locked app shells:
       `<div className="h-screen w-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">`
     - Desktop sidebar occupies full viewport height (`h-screen`) fixed on the left and never scrolls when scrolling page contents.
     - Top navbar (`h-16 shrink-0`) sits fixed at the top of the content column with branch indicators, quick action buttons, theme toggler, and user profile.
     - Content container `<main className="flex-1 h-full min-w-0 overflow-y-auto overflow-x-hidden">` serves as the sole scrolling container for Orders, Products, Inventory, Reports, and other pages.
  2. Collapsible Minimize / Expand Functionality (`Sidebar.tsx`):
     - State persistence: initialized from `localStorage.getItem('pos_sidebar_collapsed') === 'true'`.
     - Smooth width transition between expanded (`w-68 lg:w-72`) and collapsed (`w-20`) using `transition-all duration-300 ease-in-out`.
     - In expanded mode: full navigation hierarchy, brand identity header with collapse toggle button (`ChevronLeft`), categorized section titles, badges, and bottom tenant profile card.
     - In collapsed mode: centered compact icons, floating hover tooltips showing labels, badges, and keyboard shortcuts, compact brand header with expand toggle button (`ChevronRight`), and compact tenant avatar badge.
     - Main content area automatically expands to fill the available width when collapsed.
  3. Distinct Background & Theme Separation (`Sidebar.tsx`):
     - Distinct dark slate / midnight navy background (`bg-slate-900 dark:bg-[#0b0f19] border-r border-slate-800 text-slate-200 shadow-xl`) creating immediate visual contrast against both light (`bg-slate-50`) and dark (`bg-slate-950`) workspaces.
     - Active link styling: prominent `bg-brand-500 text-white shadow-md shadow-brand-500/25` with left accent bar indicator (`w-1 bg-white rounded-r-full`).
     - Inactive link styling: `text-slate-300 hover:text-white hover:bg-slate-800/80`.
     - Independent internal scrolling (`overflow-y-auto custom-scrollbar`) inside the sidebar navigation body for low-height displays.
  4. Mobile Responsive Drawer (`Sidebar.tsx` & `Navbar.tsx`):
     - For screens `< md`, mobile hamburger menu toggle in `Navbar` opens a fixed slide-out drawer with backdrop overlay.
     - Link clicks and keyboard shortcut (`Alt+S`) automatically close the mobile drawer.
  5. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - 63/63 vitest automated test cases passed across 9 test suites.
     - 38/38 QA simulation checks passed in `backend/test/qa_simulation_suite.ts`.
- Decision 49 (commit d8826f8): Enterprise Recipe Costing, Food Cost Analysis, and Menu Item Profitability Module:
  1. Complete Database Schema Migration (`011_recipe_costing_and_profitability.sql`):
     - Added `packaging_cost`, `additional_cost`, and `target_food_cost_percentage` columns to `products`, `product_variants`, and `recipes`.
     - Created `ingredient_cost_history` audit table for price fluctuation tracking across purchase invoices, supplier receipts, and manual cost edits.
  2. Costing Engine & REST Endpoints (`costingService.ts` & `costing.routes.ts`):
     - `GET /api/costing/menu-profitability`: calculates exact recipe ingredient costs from UOM base units, adds packaging/consumable costs, computes gross profit, food cost %, gross profit margin, status (`EXCELLENT`, `HEALTHY`, `WARNING`, `CRITICAL`), and portfolio summary KPIs.
     - `GET /api/costing/recipe/:productId`: returns detailed ingredient breakdown with cost share %, packaging breakdown, and live recommended price for target margin.
     - `PUT /api/costing/recipe/:productId/direct-costs`: updates packaging and additional direct costs on products and recipes.
     - `GET /api/costing/food-cost-analysis`: computes overall food cost %, category food cost %, sales vs food cost trends over time, top 10 most profitable items, top 10 highest food cost items, and multi-branch performance comparison.
     - `GET /api/costing/theoretical-vs-actual`: calculates expected recipe consumption vs actual inventory outflow, kitchen prep wastage, quantity/cost variances, and audit flags (`NORMAL`, `WATCH`, `INVESTIGATE`).
     - `GET /api/costing/ingredient-price-history`: tracks current base cost, previous vs latest purchase costs, average purchase cost, percentage change, and affected menu recipes.
     - `POST /api/costing/recalculate-recipes`: batch recalculates all recipes based on latest ingredient base costs.
  3. Power BI-Inspired Executive Dashboard (`RecipeCostingDashboard.tsx`):
     - 4 interactive tabs: Menu Item Profitability, Food Cost Analysis & Trends, Theoretical vs Actual (Wastage), and Ingredient Cost History.
     - Summary KPI cards: Total Menu Items, Avg Food Cost %, Total Recipe Cost, Avg Gross Profit per Item, Highest Food Cost Item, Most Profitable Item.
     - Search, category filter pills, sort options, and multi-item comparison drawer (up to 4 items side-by-side).
     - Recipe detail breakdown with live pricing simulator slider.
  4. Standardized Vector A4 PDF & CSV Exports (`pdfExport.ts` & `csvExport.ts`):
     - Added `exportMenuItemProfitabilityPdf`, `exportFoodCostAnalysisPdf`, `exportTheoreticalVsActualPdf`, and `exportIngredientCostHistoryPdf`.
     - Universal CSV export for all table views.
  5. Verification:
     - 8/8 automated tests in `backend/test/recipe_costing_profitability.test.ts`.
     - 13/13 tests across inventory test suites.
     - 38/38 QA simulation checks in `backend/test/qa_simulation_suite.ts`.
     - 0 build errors across `@pos/shared`, `backend`, and `frontend`.
- Decision 48 (commit e424765): Automatic Unit of Measurement (UOM) Conversion and Recipe-Based Inventory Management:
  1. Complete Multi-Dimensional Unit Engine (`shared/src/utils/unitConversion.ts`):
     - Dimensions: Weight (`KG`, `G`, `MG`), Volume (`L`, `ML`), Count/Packaging (`PCS`, `DOZEN` [12], `TRAY` [30], `BOX` [10], `CARTON` [24], `PACK`, `SACK`, `BOTTLE`, `CAN`).
     - Dimension compatibility checks (`areUnitsCompatible`) prevent erroneous conversions between weight and volume without specific density.
     - Dynamic conversion helper (`convertRecipeQtyToBase`, `convertPurchaseQtyToBase`, `calculateBaseUnitCost`, `formatDisplayStock`).
  2. Database Schema Migration (`010_unit_conversion_and_recipes.sql`):
     - Added `category`, `base_unit`, `purchase_unit`, `conversion_factor`, and `purchase_cost` to `ingredients`.
     - Added `entered_quantity`, `recipe_unit`, `unit_cost`, and `total_cost` to `recipe_ingredients`.
     - Added `purchase_unit`, `conversion_factor`, `base_quantity`, and `base_unit_cost` to `purchase_items`.
  3. Raw Material Setup & Management (`InventoryManagement.tsx` & Backend):
     - Category filter pills (`All Categories`, `Meat & Poultry`, `Dairy & Eggs`, `Produce & Vegetables`, etc.) with real-time category counts and text search.
     - Dual-unit stock representation: e.g. `10.00 KG (10,000 G)`.
     - Raw Ingredient Register & Edit modals with live conversion ratio preview (`1 KG = 1000 G`), purchase cost, and calculated base unit cost (`Rs. 1.0000 / G`).
  4. Purchase Invoice Management (`PurchaseManagement.tsx` & `inventoryService.ts`):
     - Inward purchase invoice line items allow selecting purchase package unit, quantity, and purchase unit price.
     - Live conversion indicator: e.g. `10 KG = 10,000 G (@ Rs. 1.0000 / G)`.
     - Receiving an invoice creates FIFO inventory batches in authoritative base units (`G`, `ML`, `PCS`), updates weighted-average branch base costs, and recalculates ingredient base unit cost.
  5. Recipe & Menu Item Builder (`MenuCatalog.tsx` & `inventory.routes.ts`):
     - Recipe builder rows allow selecting consumption unit (`recipeUnit`) from compatible units, entering consumption quantity, and viewing auto-converted base quantity confirmation badge (`-> 150 G`) and line cost (`Rs. 150.00`).
     - Accurate COGS and menu item profit margin calculations.
  6. Automatic POS Inventory Deduction & Reversals:
     - Deducts exact recipe base units once per completed order (idempotent across KOTs).
     - Stock reversal on order refunds and voids.
  7. Verification:
     - 8/8 automated tests in `backend/test/unit_conversion_inventory.test.ts`.
     - 5/5 automated tests in `backend/test/purchases_and_recipes.test.ts`.
     - 38/38 QA simulation checks in `backend/test/qa_simulation_suite.ts`.
     - 0 build errors across `@pos/shared`, `backend`, and `frontend`.
- Decision 47 (commit 2cccd18): Resolved empty printed bill skeleton by normalizing item fields and auto-fetching complete receipt details:
  1. Universal Receipt Data Normalizer (`ReceiptModal.tsx`):
     - Implemented `normalizeReceiptData` that robustly adapts both snake_case fields (from raw Postgres table rows in `orders` and `order_items`) and camelCase fields (from dedicated receipt endpoints).
     - Maps `product_name` / `name` -> `productName`, `variant_name` -> `variantName`, `unit_price` / `price` -> `unitPrice`, and `total_price` / `amount` -> `totalPrice`.
     - Ensures `receiptData.items` never renders blank names or `NaN` amounts in any of the 5 themes.
     - Maps all order-level properties: `order_number`, `order_type`, `table_number`, `customer_name`, `customer_phone`, `delivery_address`, `rider_name`, `rider_phone`, `subtotal`, `grand_total`, `tax_amount`, `total_discount`, and payments.
     - Added empty fallback messages for all 5 themes (`STANDARD_80MM`, `FINE_DINING`, `COMPACT_58MM`, `TAX_INVOICE_A4`, `KITCHEN_TOKEN`) when an order has no line items.
  2. Auto-Fetch Fallback in `ReceiptModal.tsx`:
     - Added an automatic `useEffect` in `ReceiptModal` that detects when an order object has an ID but is missing line items or restaurant/branch metadata (e.g. passed from list/summary views).
     - Automatically calls `GET /api/orders/:id/receipt` in the background and populates full line item details and totals.
     - Displays an animated loading state while fetching and disables printing until complete.
  3. Hardened Backend `/api/orders/:id/receipt` Endpoint (`order.routes.ts`):
     - Changed `JOIN branches` and `JOIN tenants` to `LEFT JOIN` to prevent 404/500 errors on orders with detached or null branch IDs.
     - Added robust fallbacks for `restaurant_name`, `branch_name`, `branch_phone`, `branch_address`, and `cashier_name`.
  4. Updated Action Triggers Across Software (`OrdersHub.tsx`, `Daybook.tsx`, `RestaurantDashboard.tsx`):
     - Updated 3-dots "Print / Reprint Receipt" in Orders Hub, "Print Receipt" in Daybook, and "Print Bill / Receipt" in Dashboard to call `/api/orders/:id/receipt` before opening the modal.
     - Updated Orders Hub payment settlement and Order Details modal print buttons to fetch full receipt payloads.
  5. Print Media Isolation (`Modal.tsx`, `index.css`):
     - Added `print:static print:overflow-visible print:p-0 print:transform-none` to `Modal.tsx` to prevent parent containers from clipping or scrolling long receipts.
     - Added `no-print` to Modal backdrop and header.
     - Added `.no-print` hiding and background white/border none isolation in `index.css`.
  6. Verification:
     - 100% backend production build passed (`npm --workspace=backend run build`).
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 47 (commit 2cccd18): Resolved empty printed bill skeleton by normalizing item fields and auto-fetching complete receipt details:
  1. Universal Receipt Data Normalizer (`ReceiptModal.tsx`):
     - Implemented `normalizeReceiptData` that robustly adapts both snake_case fields (from raw Postgres table rows in `orders` and `order_items`) and camelCase fields (from dedicated receipt endpoints).
     - Maps `product_name` / `name` -> `productName`, `variant_name` -> `variantName`, `unit_price` / `price` -> `unitPrice`, and `total_price` / `amount` -> `totalPrice`.
     - Ensures `receiptData.items` never renders blank names or `NaN` amounts in any of the 5 themes.
     - Maps all order-level properties: `order_number`, `order_type`, `table_number`, `customer_name`, `customer_phone`, `delivery_address`, `rider_name`, `rider_phone`, `subtotal`, `grand_total`, `tax_amount`, `total_discount`, and payments.
     - Added empty fallback messages for all 5 themes (`STANDARD_80MM`, `FINE_DINING`, `COMPACT_58MM`, `TAX_INVOICE_A4`, `KITCHEN_TOKEN`) when an order has no line items.
  2. Auto-Fetch Fallback in `ReceiptModal.tsx`:
     - Added an automatic `useEffect` in `ReceiptModal` that detects when an order object has an ID but is missing line items or restaurant/branch metadata (e.g. passed from list/summary views).
     - Automatically calls `GET /api/orders/:id/receipt` in the background and populates full line item details and totals.
     - Displays an animated loading state while fetching and disables printing until complete.
  3. Hardened Backend `/api/orders/:id/receipt` Endpoint (`order.routes.ts`):
     - Changed `JOIN branches` and `JOIN tenants` to `LEFT JOIN` to prevent 404/500 errors on orders with detached or null branch IDs.
     - Added robust fallbacks for `restaurant_name`, `branch_name`, `branch_phone`, `branch_address`, and `cashier_name`.
  4. Updated Action Triggers Across Software (`OrdersHub.tsx`, `Daybook.tsx`, `RestaurantDashboard.tsx`):
     - Updated 3-dots "Print / Reprint Receipt" in Orders Hub, "Print Receipt" in Daybook, and "Print Bill / Receipt" in Dashboard to call `/api/orders/:id/receipt` before opening the modal.
     - Updated Orders Hub payment settlement and Order Details modal print buttons to fetch full receipt payloads.
  5. Print Media Isolation (`Modal.tsx`, `index.css`):
     - Added `print:static print:overflow-visible print:p-0 print:transform-none` to `Modal.tsx` to prevent parent containers from clipping or scrolling long receipts.
     - Added `no-print` to Modal backdrop and header.
     - Added `.no-print` hiding and background white/border none isolation in `index.css`.
  6. Verification:
     - 100% backend production build passed (`npm --workspace=backend run build`).
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 46 (commit 4e17cce): Corrected Top Selling Products sorting on Restaurant Dashboard to prioritize quantity sold:
  1. Backend API Sorting (`financial.routes.ts`):
     - Updated `/api/financial/reports/sales-by-product` to sort by `total_quantity DESC, total_sales DESC` by default, ensuring higher volume items rank ahead of higher-priced low-volume items.
     - Added optional `sortBy=sales` parameter for cases requiring revenue-based sorting.
  2. Frontend Dashboard Sorting (`RestaurantDashboard.tsx`):
     - Explicitly sorted `productsRes.products` by `total_quantity DESC` with `total_sales DESC` tie-breaker before taking the top 6.
  3. Verification:
     - 100% frontend and backend production builds passed.
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 46 (commit 4e17cce): Corrected Top Selling Products sorting on Restaurant Dashboard to prioritize quantity sold:
  1. Backend API Sorting (`financial.routes.ts`):
     - Updated `/api/financial/reports/sales-by-product` to sort by `total_quantity DESC, total_sales DESC` by default, ensuring higher volume items rank ahead of higher-priced low-volume items.
     - Added optional `sortBy=sales` parameter for cases requiring revenue-based sorting.
  2. Frontend Dashboard Sorting (`RestaurantDashboard.tsx`):
     - Explicitly sorted `productsRes.products` by `total_quantity DESC` with `total_sales DESC` tie-breaker before taking the top 6.
  3. Verification:
     - 100% frontend and backend production builds passed.
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 45 (commit d60c84c): Improved POS terminal product card visual feedback with prominent selected borders and quantity badges:
  1. Prominent Selected-Item Border & Styling:
     - Applied `border-2 border-brand-500 dark:border-brand-400`, subtle warm background tint (`bg-brand-50/25 dark:bg-brand-950/20`), elevated shadow (`shadow-md`), and glowing halo ring (`ring-2 ring-brand-500/20`) whenever an item is added to the active bill.
     - Smoothly transitions back to default styling (`border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900`) when the item is removed from the bill.
  2. Real-Time Quantity Counter Badge:
     - Positioned an eye-catching quantity pill (`absolute -top-2 -right-2 z-20 min-w-[24px] h-6 px-1.5 rounded-full bg-brand-500 text-white text-xs font-black shadow-md border-2 border-white dark:border-slate-900`) on the top-right corner of each product card.
     - Automatically displays the total units of that item added to the bill, updating instantaneously upon cart increments, decrements, or deletions.
     - Completely hides when the item is not in the bill (quantity 0).
  3. Visual Consistency & Zero Distortion:
     - Positioned the badge to avoid obscuring SKU, station, product title, category, or price.
     - Applied consistent visual feedback across both responsive squared grid view and vertical list view modes across all categories.
     - Preserved all billing, pricing, tax, and inventory calculations.
  4. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 45 (commit d60c84c): Improved POS terminal product card visual feedback with prominent selected borders and quantity badges:
  1. Prominent Selected-Item Border & Styling:
     - Applied `border-2 border-brand-500 dark:border-brand-400`, subtle warm background tint (`bg-brand-50/25 dark:bg-brand-950/20`), elevated shadow (`shadow-md`), and glowing halo ring (`ring-2 ring-brand-500/20`) whenever an item is added to the active bill.
     - Smoothly transitions back to default styling (`border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900`) when the item is removed from the bill.
  2. Real-Time Quantity Counter Badge:
     - Positioned an eye-catching quantity pill (`absolute -top-2 -right-2 z-20 min-w-[24px] h-6 px-1.5 rounded-full bg-brand-500 text-white text-xs font-black shadow-md border-2 border-white dark:border-slate-900`) on the top-right corner of each product card.
     - Automatically displays the total units of that item added to the bill, updating instantaneously upon cart increments, decrements, or deletions.
     - Completely hides when the item is not in the bill (quantity 0).
  3. Visual Consistency & Zero Distortion:
     - Positioned the badge to avoid obscuring SKU, station, product title, category, or price.
     - Applied consistent visual feedback across both responsive squared grid view and vertical list view modes across all categories.
     - Preserved all billing, pricing, tax, and inventory calculations.
  4. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 44 (commit c84cf03): Resolved Bill-Wise Profit & Loss navigation, tab synchronization, branch filtering, and itemized A4 PDF breakdown:
  1. Fixed Navigation & Routing:
     - Updated `Sidebar.tsx` navigation link to point to `/app/reports/bill-profit-loss`.
     - Enhanced `isCurrentActive` matching to correctly distinguish `/app/reports/bill-profit-loss` from `/app/reports` and handle `?tab=BILL_PROFIT_LOSS`.
  2. Tab State Synchronization:
     - Added `useEffect` in `FinancialReports.tsx` synchronizing `location.pathname` and `queryTab` to `activeTab`, resolving the bug where clicking the menu failed to switch tabs when `FinancialReports` was already mounted.
     - Wrapped sub-report tabs with `handleTabChange` to synchronize URL route state and enable standard browser history back/forward navigation.
  3. Branch Filtering & Reactive Loading:
     - Appended missing `${branchParam}` to the `/financial/reports/bill-profit-loss` API query.
     - Added `currentBranchId` to the `useEffect` dependencies for instant refetching upon switching branches.
     - Added a clean animated loading spinner while bill records are querying.
  4. Standardized 3-Dots ActionMenu:
     - Replaced raw button in the bill-wise table with `ActionMenu` containing View Breakdown, Download A4 PDF, and Print A4 Breakdown.
  5. Individual Bill A4 PDF Breakdown:
     - Implemented `exportSingleBillProfitLossPdf` in `pdfExport.ts` producing vector A4 audit vouchers with complete item-by-item FIFO ingredient cost, selling price, gross profit, margin %, financial reconciliation summary card, and dual signatures.
     - Added Download A4 PDF and Print A4 buttons directly in the Breakdown details modal.
  6. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - 100% backend production build passed (`npm --workspace=backend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 43 (commit 1ecb019): Standardized business reporting on professional A4 PDF format across Daybook, Shift Reconciliation, Purchases, and Cash & Bank:
- Decision 42 (commit 24ad8dd): Standardized 3-dots action menu and completed verified CRUD operations across all modules:
  1. Backend Endpoints Added & Hardened:
     - financial.routes.ts: DELETE /api/financial/bank-accounts/:id (soft-deactivates account and safely reassigns default) and DELETE /api/financial/cash-bank/transfers/:id (reverses cash/bank balances and deletes contra voucher).
     - inventory.routes.ts: PUT /api/inventory/ingredients/:id, DELETE /api/inventory/ingredients/:id (with safety check on usage in active recipes), DELETE /api/inventory/recipes/:id, PUT /api/inventory/suppliers/:id, DELETE /api/inventory/suppliers/:id (checks for purchase history), DELETE /api/inventory/purchases/:id (drafts only), and DELETE /api/inventory/transfers/:id (pending transfers only).
     - restaurant.routes.ts: PUT /api/restaurant/branches/:id (updates branch details and main flagship status), DELETE /api/restaurant/branches/:id (guards primary branch and soft-deactivates if orders exist).
  2. Cash & Bank Module (CashAndBank.tsx):
     - Added Delete Bank Account, Set as Default POS Bank, and View Account Book.
     - Added 3-dots ActionMenu to every account in the Left Sidebar accounts list (MASTER_DETAIL view).
     - Added 3-dots ActionMenu to TRANSFERS contra register table (View Voucher, Print Voucher, Reverse & Delete Transfer).
     - Replaced raw alert(...) on the ledger table with a dedicated Transaction Particulars modal.
     - Added Fund Transfer Voucher Details modal with print voucher and reverse buttons.
  3. Inventory Management (InventoryManagement.tsx):
     - Added Edit Ingredient modal and Delete Ingredient action (ActionMenu) on Stock List table.
     - Added 3-dots ActionMenu on Batches table (Waste / Write-off stock, filter by item).
     - Added 3-dots ActionMenu on Recipe cards (Delete recipe).
     - Replaced raw buttons with 3-dots ActionMenu on Inter-Branch Transfers table (Dispatch, Receive, Cancel/Delete transfer).
  4. Purchases & Suppliers (PurchaseManagement.tsx):
     - Added 3-dots ActionMenu to Suppliers table with Edit Supplier Details, Record Inward Purchase, and Delete Supplier.
     - Added Edit Supplier modal.
     - Added Cancel & Delete Draft Invoice to Inward Purchases ActionMenu.
  5. Branch Management (BranchManagement.tsx):
     - Added 3-dots ActionMenu to Branch cards with Edit Branch Details, Set as Main Flagship, and Delete/Deactivate Branch.
     - Added Edit Branch modal.
  6. Shift Management (ShiftManagement.tsx):
     - Added 3-dots ActionMenu on Closed Shift Reconciliation History table.
     - Added View Shift Breakdown modal with detailed cash float, sales, refunds, expected vs actual cash, and variance.
     - Added Print Z-Report Slip action.
  7. Daybook (Daybook.tsx):
     - Added 3-dots ActionMenu across remaining sub-tables: Inward Purchases (View Invoice, Print Purchase Slip), Operational Expenses (View Voucher, Print Payment Slip), and Cashier Shifts (View Breakdown, Print Z-Report).
     - Added detailed modals and print formatters for each.
  8. Restaurant Dashboard (RestaurantDashboard.tsx):
     - Added 3-dots ActionMenu on Recent Orders with View Order Breakdown (opens modal) and Print Bill / Receipt (opens ReceiptModal).
  9. Verification & QC:
     - 100% backend production build passed (npm --workspace=backend run build).
     - 100% frontend production build passed (npm --workspace=frontend run build).
     - All 38 simulation checks passed in npx tsx backend/test/qa_simulation_suite.ts.
- Decision 41 (commit 83e4481): Managed print themes from settings, removed template selector tabs from bill printing modal, and modernized receipt styling:
  1. Receipt Printing Modal Streamlining (`ReceiptModal.tsx`):
     - Removed the template selector tab bar and option toggles that previously cluttered the bill modal during checkout.
     - Cashiers can now preview and print bills immediately with 1-click speed.
     - Clean modal header with unobtrusive active theme indicator (`Theme: Standard 80mm POS Thermal`) and subtle settings management hint.
     - Automatically uses the default template configured in restaurant settings (`defaultTemplate` or `localStorage.pos_default_receipt_template`).
  2. Print Themes & Receipt Designer in Settings (`RestaurantSettings.tsx`):
     - Created an interactive visual theme designer section in Restaurant Settings.
     - Provided 5 visual theme selection cards with hardware specs, feature badges, and active selection rings:
       * Standard 80mm POS Thermal (Recommended for standard 80mm receipt printers)
       * Fine Dining Guest Check (Dine-In slip with covers, server, tip guide, signature lines)
       * Compact 58mm Mobile Roll (Mobile/handheld Bluetooth and kiosk roll)
       * Official GST Tax Invoice (A4) (Commercial invoice with full tax compliance)
       * Kitchen Dispatch / Prep Token (High-contrast ticket for kitchen prep and pickup tokens)
     - Interactive controls for paper width (80mm, 58mm, A4), header greeting, footer thank-you message, STRN/NTN toggle, QR code toggle, customer details toggle, and gratuity guide toggle.
     - Live Real-Time Interactive Receipt Preview embedded directly inside Settings, re-rendering instantly upon theme selection or header/footer edits.
     - "Test Print Sample" button right in Settings to test thermal hardware before operating.
     - Removed leftover `bilingualUrduEnglish` checkbox, ensuring 100% English across software.
  3. Receipt Styling Modernization:
     - High-contrast, razor-sharp typography for both screen preview and 203 DPI thermal printing.
     - Crisp double-dashed borders, tabular numbers, item customizations/notes indentation, and bold high-contrast grand total banner.
  4. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 40 (commit 0984e05): Turned off blinking in Kitchen Display System (KDS):
  1. Replaced pulsing animations with steady high-contrast warning borders:
     - Removed `animate-pulse` from delayed order cards in `KitchenDisplay.tsx`, replacing it with a steady alert border (`border-rose-500 ring-2 ring-rose-500/50`).
     - Removed `animate-spin` from the timer clock icon.
     - Removed `animate-pulse` from the delayed tickets badge in the KDS header.
  2. Maintained all visual alert criteria (color-coded status badges, urgent time indicators, audio chime) without visual blinking or eye fatigue.
  3. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 39 (commit 939bc9f): UI Cleanup for Sales Menu and Orders Filter Bar:
  1. Renamed Sales Menu in Sidebar:
     - Replaced "Sales Invoices & Orders" with single concise "Orders" item.
  2. Removed Duplicate Order History Dropdown:
     - Removed redundant date filter dropdown from upper filter bar on OrdersHub.tsx.
  3. Proportional Filter Bar Layout:
     - Expanded remaining 3 filter controls across 12-column grid: Search (50%), Status (25%), Order Type (25%).
- Decision 38 (commit d8f6051): Isolated POS Menu Scroller & Fixed Viewport:
  1. Fixed double-scroll bug by adding `.pos-menu-scroller` with `overscroll-behavior: contain !important`.
  2. Anchored root container with `fixed inset-0 h-full w-full max-h-screen overflow-hidden` and added mount effect locking `body` and `html` overflow.
- Decision 37 (commit f89ed1f): Modernized POS Terminal UI:
  1. Category Bar: Horizontal scrollable category pills + vertical divider bar (`|`) + subcategory pills.
  2. Item Grid: Responsive squared product cards (`aspect-square`) with badge, price, and instant touch-friendly ordering.
- Decision 41 (commit 83e4481): Managed print themes from settings, removed template selector tabs from bill printing modal, and modernized receipt styling:
  1. Receipt Printing Modal Streamlining (`ReceiptModal.tsx`):
     - Removed the template selector tab bar and option toggles that previously cluttered the bill modal during checkout.
     - Cashiers can now preview and print bills immediately with 1-click speed.
     - Clean modal header with unobtrusive active theme indicator (`Theme: Standard 80mm POS Thermal`) and subtle settings management hint.
     - Automatically uses the default template configured in restaurant settings (`defaultTemplate` or `localStorage.pos_default_receipt_template`).
  2. Print Themes & Receipt Designer in Settings (`RestaurantSettings.tsx`):
     - Created an interactive visual theme designer section in Restaurant Settings.
     - Provided 5 visual theme selection cards with hardware specs, feature badges, and active selection rings:
       * Standard 80mm POS Thermal (Recommended for standard 80mm receipt printers)
       * Fine Dining Guest Check (Dine-In slip with covers, server, tip guide, signature lines)
       * Compact 58mm Mobile Roll (Mobile/handheld Bluetooth and kiosk roll)
       * Official GST Tax Invoice (A4) (Commercial invoice with full tax compliance)
       * Kitchen Dispatch / Prep Token (High-contrast ticket for kitchen prep and pickup tokens)
     - Interactive controls for paper width (80mm, 58mm, A4), header greeting, footer thank-you message, STRN/NTN toggle, QR code toggle, customer details toggle, and gratuity guide toggle.
     - Live Real-Time Interactive Receipt Preview embedded directly inside Settings, re-rendering instantly upon theme selection or header/footer edits.
     - "Test Print Sample" button right in Settings to test thermal hardware before operating.
     - Removed leftover `bilingualUrduEnglish` checkbox, ensuring 100% English across software.
  3. Receipt Styling Modernization:
     - High-contrast, razor-sharp typography for both screen preview and 203 DPI thermal printing.
     - Crisp double-dashed borders, tabular numbers, item customizations/notes indentation, and bold high-contrast grand total banner.
  4. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 40 (commit 0984e05): Turned off blinking in Kitchen Display System (KDS):
  1. Replaced pulsing animations with steady high-contrast warning borders:
     - Removed `animate-pulse` from delayed order cards in `KitchenDisplay.tsx`, replacing it with a steady alert border (`border-rose-500 ring-2 ring-rose-500/50`).
     - Removed `animate-spin` from the timer clock icon.
     - Removed `animate-pulse` from the delayed tickets badge in the KDS header.
  2. Maintained all visual alert criteria (color-coded status badges, urgent time indicators, audio chime) without visual blinking or eye fatigue.
  3. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 39 (commit 939bc9f): UI Cleanup for Sales Menu and Orders Filter Bar:
  1. Renamed Sales Menu in Sidebar:
     - Replaced "Sales Invoices & Orders" with single concise "Orders" item.
  2. Removed Duplicate Order History Dropdown:
     - Removed redundant date filter dropdown from upper filter bar on OrdersHub.tsx.
  3. Proportional Filter Bar Layout:
     - Expanded remaining 3 filter controls across 12-column grid: Search (50%), Status (25%), Order Type (25%).
- Decision 38 (commit d8f6051): Isolated POS Menu Scroller & Fixed Viewport:
  1. Fixed double-scroll bug by adding `.pos-menu-scroller` with `overscroll-behavior: contain !important`.
  2. Anchored root container with `fixed inset-0 h-full w-full max-h-screen overflow-hidden` and added mount effect locking `body` and `html` overflow.
- Decision 37 (commit f89ed1f): Modernized POS Terminal UI:
  1. Category Bar: Horizontal scrollable category pills + vertical divider bar (`|`) + subcategory pills.
  2. Item Grid: Responsive squared product cards (`aspect-square`) with badge, price, and instant touch-friendly ordering.
- Decision 36 (commit 9401ff5): Redesigned Cash & Bank module following the authentic Vyapar Software UI system:
  1. Two-Pane Master-Detail Account Explorer & Ledger:
     - Left Accounts Explorer (w-80): instant search, Consolidated All Accounts book card, Cash in Hand drawer cash card, and bank account cards with active selection states, balances, and 3-dots actions.
     - Right Account Ledger: Account profile banner with large available balance, Quick Deposit (+ Cash to Bank) and Withdrawal (- Bank to Cash) buttons, preset date filters (Today, Week, Month, All Time, Custom), direction filters (All, Money In/Credit, Money Out/Debit, Contra Transfers), search, period tally, and the trademark Vyapar transaction table with exact RUNNING BALANCE.
  2. Multi-View Options:
     - Account Books (Master-Detail, default).
     - Bank Accounts Cards Grid.
     - Cash ⇄ Bank Transfers Contra Register.
  3. PDF Statement Generation:
     - Built `exportCashBankLedgerPdf` in `frontend/src/utils/pdfExport.ts` producing an official A4 statement with restaurant branding, account details, closing balance, inflow/outflow tallies, and full running balance ledger table.
  4. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
- Decision 35 (commit dc3f2f6): Resolved Restaurant Dashboard Freeze and Implemented Instant Real-Time Order Reactivity:
  1. Root Cause Diagnosis of Frozen Dashboard:
     - Discovered fatal query string syntax bug in RestaurantDashboard.tsx where /orders/active was queried as `/orders/active${branchParam}` with `branchParam = '&branchId=...'`.
     - Lacking a '?', Fastify matched this URL against parameterized route `/api/orders/:id` with `id = "active&branchId=..."`.
     - PostgreSQL threw unhandled 500: `invalid input syntax for type uuid: "active&branchId=..."`.
     - Because this call ran inside `Promise.all([summaryRes, ordersRes, activeRes, productsRes])`, the entire promise rejected on every initial load and every 5-second polling interval, silently preventing `summary`, `recentOrders`, `activeOrders`, and `topProducts` from ever updating!
  2. End-to-End Bug Fixes & Hardening:
     - Fixed query syntax in RestaurantDashboard.tsx to `/orders/active?branchId=${branchId}` (returning 200 with orders array).
     - Standardized date ranges using `getTodayRangeISO()` for local 24-hour day consistency.
     - Repaired field mappings in Top Selling Products: mapped `product_name || name` and `total_quantity || total_quantity_sold`.
     - Added defensive UUID regex validation in GET `/api/orders/:id` returning 404 instead of 500 when invalid IDs are received.
  3. Real-Time Reactivity & Multi-Tab Synchronization:
     - Reduced auto-polling interval from 5 seconds to 3 seconds.
     - Added instant custom event listener `pos_order_updated` and `storage` / `focus` / `visibilitychange` listeners in RestaurantDashboard.tsx.
     - Dispatched `pos_order_updated` and updated `pos_last_order_at` in PosTerminal.tsx (on send to kitchen & checkout), OrdersHub.tsx (on payment settlement, cancellation, and deletion), and KitchenDisplay.tsx (on status transitions to Ready/Served).
     - Expanded Live Operations banner to display all in-flight active orders (cooking in kitchen + served awaiting payment) with live pulse, order cards, and 1-click POS payment collection links.
  4. Verification:
     - 100% frontend production build passed (`npm --workspace=frontend run build`).
     - All 38 simulation checks passed in `npx tsx backend/test/qa_simulation_suite.ts`.
     - All 47 backend integration tests passed in `npm --workspace=backend run test`.
     - Automated live end-to-end test proved immediate dashboard update on order creation (active orders 4 -> 5, recent orders populated) and immediate sales update on POS payment checkout (completed orders 24 -> 25, net sales 30,110 -> 34,910).
- Decision 34 (commit a352460): Redesigned Menu Navigation System following the Vyapar Style System:
  1. Vyapar Quick Add Sale Action:
     - Added prominent top +ADD SALE / BILL button with gradient styling and global Alt+S keyboard shortcut triggering immediate POS terminal navigation from any screen.
  2. Vyapar Categorized Navigation Modules:
     - General / Core: Dashboard, POS Billing Terminal (SALE badge), Sales Invoices & Orders Hub, Kitchen Display KDS (LIVE badge), Workspace Hub.
     - Items & Catalog: Menu & Products, Stock & FIFO Batches.
     - Purchase & Expenses: Purchases & Vendors, Cash Registers & Shifts.
     - Cash & Bank (Banking): Cash & Bank Accounts (BANKING badge).
     - Reports & Analytics: Daily Daybook Ledger (DAILY badge), Financial Reports & P&L, Bill-Wise Profit & Loss.
     - Settings & System: Staff & Roles, Restaurant Settings.
  3. Vyapar Visual Identity & Polish:
     - Crisp uppercase section headers with subtle indicator dots, left accent highlight bar for active menu item, high-contrast dark/white active pill, category badges, and bottom company & sync status footer.
  4. Production verification: TypeScript build passed with 0 errors, all 47 backend integration tests passed, and 38/38 QA simulation checks passed.
- Decision 33 (commit 8e3eca8): Centralized Cash & Bank and Daybook under Reports, Added Daybook PDF Download, Removed All Urdu, and Standardized 3-Dots Action Menus:
  1. Information Architecture & Navigation:
     - Grouped Daily Daybook (/app/reports/daybook) and Cash & Bank (/app/reports/cash-and-bank) under Reports & Analytics in Sidebar.tsx.
     - Integrated Daybook and Cash & Bank as primary tabs (DAYBOOK and CASH_BANK) inside FinancialReports.tsx alongside Executive Overview, Bill-Wise P&L, Sales, Purchases, and Expenses.
     - Maintained backward-compatible route aliases (/app/daybook, /app/cash-and-bank) in App.tsx.
  2. Daybook PDF Download:
     - Built exportDaybookPdf in frontend/src/utils/pdfExport.ts delivering a formatted portrait A4 PDF with restaurant & branch branding, executive KPI banner, payment method breakdown, sales order ledger, inward purchases, ingredient FIFO consumption, operating expenses, kitchen wastage, and shift drawer cash reconciliation.
     - Added prominent Download PDF button with instant generation to Daybook.tsx.
  3. Complete Urdu Removal (100% English UI):
     - Removed all Urdu wording, subtitles, placeholders, font imports (Noto Nastaliq Urdu), and classes (.font-urdu) across ReceiptModal, MenuCatalog, PosTerminal, Daybook, CashAndBank, OnboardingWizard, and RestaurantSettings.
  4. Universal 3-Vertical-Dots Action Menu (ActionMenu):
     - Expanded ActionMenu across all modules: Purchase Management (inward purchases), Cash & Bank (bank account cards & transfers), Active Orders cards in Orders Hub, Daybook tables (sales, purchases, expenses, wastage, shifts), Inventory Management (transfers), and Shift Management (history).
  5. Zero test regressions: frontend production build succeeds with 0 errors, all 47 backend integration tests pass, and 38/38 QA simulation checks pass.
- Decision 32 (commit 0307922): Modernized Menu and Product Center for High-Volume Restaurant POS Workflows:
  1. Complete Redesign of Menu Catalog (MenuCatalog.tsx):
     - Added Executive KPI Stats Cards: Total Products, Available in POS (In-Stock), 86'd / Out of Stock, and Catalog-Wide Average Gross Margin %.
     - Dual View Modes: Table / Data Rows View and Modern POS Product Card Grid View with Food Avatars, Dish Badges, Margin Progress Bars, and Kebab Actions.
     - Advanced Filtering & Search: Instant text search (English/Urdu/SKU/Barcode), Horizontal Category Pill Selector with count badges, Nested Subcategory Pills strip, Station Filter (Kitchen, BBQ, Drinks, Desserts, Packaging), and Stock Status Filter (In-Stock, Out-of-Stock, With Recipe, No Recipe).
  2. Consolidated 3-Vertical-Dots Action Menu (ActionMenu):
     - Replaced scattered raw action buttons with a sleek 3-dots kebab dropdown on every product row and grid card.
     - Houses full CRUD and Print options: Preview details & margin breakdown, Edit product, Recipe & ingredients builder, Print barcode label / shelf price tag (50x30mm / 80mm format), Print kitchen recipe specification SOP sheet, Duplicate item (1-click cloning), Quick toggle availability (In stock vs 86'd), Delete product.
  3. Professional POS Print Modals:
     - Barcode / Shelf Price Tag Modal: Formatted for 50x30mm shelf tags and 80mm sticker rolls with code lines, retail price in Rs., SKU, category, and date.
     - Kitchen Recipe Spec SOP Modal: Standard operating procedure sheet with portion size, prep time, ingredient breakdown with batch lot costs, retail price, gross margin %, and kitchen supervisor signature lines.
     - Customer Dining Menu Print Modal: Full restaurant menu export grouped by categories and subcategories with Urdu subtitles, prices, and addons.
  4. CSV Export: 1-click catalog export containing SKU, Name, Category, Retail Price, Cost Price, Margin %, and Active status.
  5. Verified TypeScript compiles with 0 errors (npm --workspace=frontend run build), all 47 backend integration tests pass (npm --workspace=backend run test), and 38/38 QA simulation checks pass (npx tsx backend/test/qa_simulation_suite.ts).
- Decision 30: Comprehensive Restaurant Owner QA/QC Simulation and Daybook Reconciliation Bug Fix:
  1. Built live 38-step QA and QC simulation runner (backend/test/qa_simulation_suite.ts) testing all operational workflows against the live server: multi-role authentication (Owner, Manager, Cashier, Waiter, Kitchen), Menu Catalog & Subcategories, raw inventory ingredients, Addons / Modifiers, Recipe creation and FIFO lot consumption, Inward Purchases and receiving, Cash & Bank two-way transfers, Dine-In KDS multi-station workflow, Takeaway with customer info and Bank Transfer settlement, Delivery with Rider dispatch and delivery fees, End-of-day Cash Deposit, security role barriers (403), input validation (400), and 3-dots CRUD duplication.
  2. Diagnosed and fixed Daybook Net Sales anomaly: in backend/src/services/financialService.ts getDaybookData, total_net_sales was subtracting only tax and delivery fee from grand_total without deducting service charges, causing Daybook to report higher Net Sales than Dashboard and Bill-Wise P&L when service charges were enabled. Updated to (o.subtotal - o.total_discount) matching Dashboard and Reports.
  3. Fixed delivery_fee query selection: added COALESCE(SUM(delivery_fee), 0)::numeric as delivery_fees to generateFinancialSummary orderQuery.
  4. All 38 simulation checks passed with 100% mathematical reconciliation, and all 47 backend integration tests passed.
- Decision 29 (commit f8baa97): Cross-Software Data Consistency & Reconciliation Audit:
  1. Root cause diagnosed: Identified a 19-hour date boundary discrepancy between Dashboard and Financial Reports. In Pakistan (UTC+5), local midnight of Nov 5 converted to 2026-11-04T19:00:00.000Z, while Financial Reports used UTC new Date().toISOString().split('T')[0] appending T00:00:00Z, querying yesterday's data.
  2. Built unified frontend/src/utils/dateUtils.ts providing getLocalYMD(), getLocalDayRangeISO(), and getTodayRangeISO() ensuring 100% identical start-of-day (00:00:00.000) and end-of-day (23:59:59.999) timestamps across Dashboard, Reports, Daybook, and Orders Hub.
  3. Unified branch parameter scoping: Ensured branchParam (currentBranchId || branches[0]?.id) is consistently passed to all financial report tabs (Overview, Sales, FIFO COGS, Purchases, Expenses, Bill-Wise P&L) and CSV exports.
  4. Fixed delivery_fee omission in generateFinancialSummary: Included delivery_fee in orders aggregation so totalCollected reconciles with grand_total and payments.
  5. Corrected COGS calculation in sales-by-product to avoid double-multiplying quantity on line item COGS (oi.cogs is already line total).
  6. Added 1-click Quick Date Presets (Today, Yesterday, 7 Days, This Month) to Financial Reports for seamless navigation.
- Decision 28 (commit 04a6162): Implemented Bill-Wise Profit and Loss Report:
  1. Built backend endpoints GET /api/financial/reports/bill-profit-loss and GET /api/financial/reports/bill-profit-loss/export.
  2. Added dedicated BILL_PROFIT_LOSS tab in FinancialReports.tsx with 6 executive KPI cards, channel filters (Dine-in, Takeaway, Delivery), search, multi-field sorting, and interactive itemized cost & profit modal.
  3. Added landscape PDF export in frontend/src/utils/pdfExport.ts (exportBillWiseProfitLossPdf).
  4. Added automated integration test M8 in backend/test/fifo_and_features.test.ts.
- Decision 27 (commit 99e875e): Implemented Cash & Bank Management and POS Payment Integration:
  1. Created migration 009_create_cash_and_bank.sql for bank_accounts and cash_bank_transfers.
  2. Implemented two-way fund transfers (Cash to Bank deposit, Bank to Cash replenishment, Bank to Bank transfer) with atomic balance updates.
  3. Integrated bank account selection in POS Terminal checkout modal for Bank/Card payments.
  4. Added Cash & Bank UI dashboard at /app/cash-and-bank with ledger and printable statements.
- Decision 26 (commit dedf2fa): Streamlined POS System to Single Restaurant Branch Mode:
  1. Locked AuthContext directly to the primary restaurant branch.
  2. Removed BranchSelector and multi-branch comparative matrices from all operational terminals while preserving database schema for future scaling.
- Decision 25: Implemented 3-Dots Action Menu (Kebab Menu) with Delete, Preview, and Multi-CRUD Operations:
  1. Built reusable ActionMenu component in frontend/src/components/common/ActionMenu.tsx featuring 3-dots trigger (MoreVertical), smart viewport boundary collision detection (auto-flips upward if near bottom), click-outside and Escape key handling, and semantic action styles (default, danger, warning, success).
  2. Menu Catalog CRUD Upgrades (MenuCatalog.tsx):
     - Products Table: Integrated 3-dots ActionMenu on each item row: Preview Details, Edit Product, Duplicate Item, Recipe Ingredients, In-Stock/Out-of-Stock Status Toggle, and Delete Product.
     - Built comprehensive Product Preview Modal displaying item financials (retail price, cost price, calculated recipe cost, gross profit, margin %), station, SKU/barcode, inventory tracking, attached addon groups, recipe ingredient table with costs, and 1-click Edit/Recipe buttons.
     - Added 1-click product duplication (handleDuplicateProduct) and availability toggle (handleToggleAvailability via PUT /api/menu/products/:id).
     - Categories Table: Integrated 3-dots ActionMenu with Edit Category, Add Sub-Category, and Delete Category.
     - Addon Groups Table: Integrated 3-dots ActionMenu with Edit Addon Group and Delete Addon Group.
  3. Orders Hub CRUD Upgrades (OrdersHub.tsx):
     - In All Orders History Table: Replaced raw buttons with 3-dots ActionMenu on every order row with Preview Order Breakdown, Print / Reprint Receipt (5-templates), Take Payment / Settle (for unpaid orders), Cancel Order (for active orders), and Delete Order Record.
     - Added backend DELETE /api/orders/:id route in backend/src/routes/order.routes.ts to safely delete order records with table status release and cascade cleanup.
  4. Staff & Roles Management CRUD (StaffManagement.tsx): Upgraded row action buttons with 3-dots ActionMenu for Edit Employee, Reset Password, and Activate/Deactivate Account.
  5. Zero test regressions: all 44 automated backend integration tests pass and builds succeed with 0 errors.
- Decision 24: Streamlined POS Terminal Order Types and Added Customer & Rider Information:
  1. Streamlined order types from 4 buttons to 3 core channels: Dine-In, Takeaway, and Delivery. Removed redundant Counter option since Takeaway covers direct over-the-counter sales.
  2. Takeaway Customer Details: Rendered dedicated Takeaway customer information card prompting for Customer Name and Mobile Number, persisting them to the order and rendering them on Takeaway receipts and tickets.
  3. Delivery Customer & Rider Dispatch Details:
     - Customer Name and Customer Mobile Number.
     - Delivery Address textarea.
     - Editable Delivery Fee with quick presets (Free, 100, 150, 200, 250).
     - Assigned Rider Details: Rider Name and Rider Mobile Number with Bike indicator icon.
  4. Backend & Database Persistence:
     - Added migration 008_add_rider_fields_to_orders.sql adding rider_name VARCHAR(255) and rider_phone VARCHAR(50) to orders table.
     - Updated @pos/shared CreateOrderSchema to accept riderName and riderPhone.
     - Updated orderService.ts to insert and return rider_name and rider_phone (RETURNING *).
     - Updated order.routes.ts /orders/:id/receipt to output riderName and riderPhone.
  5. Multi-Template Receipts & WhatsApp: Updated ReceiptModal.tsx to display Rider Name and Phone on Standard 80mm thermal receipts, Commercial GST Tax Invoices, and WhatsApp dispatch share slips.
  6. Added automated integration test M5 in backend/test/fifo_and_features.test.ts verifying Takeaway customer details and Delivery order creation with rider details and receipt verification. All 44 integration tests pass.
- Decision 23: Optimized POS Terminal Layout with Vertical Categories, Subcategories, Editable Delivery Pricing, Customer Mobile/Name Section, and Resizable Billing Width:
  1. Built an ergonomic 3-column POS interface: 1) Vertical Categories & Subcategories Sidebar on the left with item counters and accordion navigation; 2) Menu Items section with default Vertical List View and Grid toggle; 3) Resizable Billing / Cart Section on the right.
  2. Implemented adjustable billing section width with an interactive draggable divider handle (supports smooth resizing from 320px to 800px) and one-click width presets: Compact (S: 340px), Standard (M: 420px), Wide (L: 540px), Expanded (XL: 680px), and an instant Expand/Shrink toggle. Persists user preference to localStorage.
  3. Built dedicated Delivery Order Information panel when Order Type is Delivery: Customer Name input, Mobile Number input, Delivery Address input, and editable Delivery Fee/Price with quick presets (Free, 100, 150, 200, 250).
  4. Factored delivery fee into real-time subtotal, tax, and grand total calculations on both frontend and backend, with full receipt generation support.
- Decision 22: Implemented Custom Date Selector and Range Filter in Orders Hub:
  1. Built dedicated Specific Date Calendar selector and Custom Date Range controls in OrdersHub.tsx All Orders History tab.
  2. Supported quick 1-click day navigation: Jump to Previous Day, Jump to Next Day, and Jump to Today shortcut, with localized human-friendly date headers (e.g., "Wed, Nov 4, 2026").
  3. Integrated branch selector filter allowing managers to audit orders across specific branches or all branches consolidated.
  4. Enhanced backend GET /api/orders to calculate period financial aggregates (total orders, total revenue, completed sales amount, completed count, cancelled count) in a single optimized query.
  5. Rendered live financial summary cards strip above the history orders table displaying filtered metrics for the selected date.
  6. Added automated integration test in backend/test/fifo_and_features.test.ts verifying date boundary queries and financial summary payloads. All 43 tests pass.
- Decision 21 (commit 2fd06aa): Resolved Branch Filtering Mismatch, Timezone Boundary Calculation, and POS Branch Association:
  1. Root cause analysis: User reported Today's Net Sales Rs. 0 and no sales on the dashboard despite orders being served. In PostgreSQL, `Lahore Karahi & Grill` had 3 completed orders with Rs. 10,100 net sales and Rs. 12,221 collections, but all were assigned to `Gulberg Main Branch` (`LHE-01`). The user session had switched or defaulted to `DHA Phase 5 Branch` (`LHE-02`), which was newly provisioned with 0 orders.
  2. POS Terminal Branch association bug: In `PosTerminal.tsx`, orders were being submitted with hardcoded `user!.branchId` instead of the active session's `currentBranchId || user?.branchId || branches[0]?.id`. Now POS accurately routes orders to the selected branch.
  3. Timezone calculation fix: In `RestaurantDashboard.tsx`, date boundaries were computed using `new Date().toISOString().split('T')[0]`, which misaligned with local UTC+5 midnight. Switched to local start-of-day (00:00:00.000) and end-of-day (23:59:59.999).
  4. Active order status inclusion: Included `'CONFIRMED'` in active order aggregations in `financialService.ts` and `financial.routes.ts`.
  5. In-Dashboard Branch Switcher & Multi-Branch Sales Banner: Directly embedded `<BranchSelector variant="navbar" />` in the dashboard header, and created an intelligent multi-branch alert banner that informs managers when the currently viewed branch has Rs. 0 sales but another branch has active sales, offering 1-click buttons to switch branches or view the consolidated Head Office metrics.
- Decision 20 (commit 30c075f): Resolved KDS-to-Dashboard data synchronization and unpaid order visibility:
  1. Identified that financial report endpoints only accounted for COMPLETED orders, omitting in-flight and served/unpaid tickets, while the Dashboard lacked auto-polling.
  2. Implemented 5-second background auto-polling in `RestaurantDashboard.tsx` with a pulsing live sync badge and manual refresh button.
  3. Integrated `GET /api/orders/active` into both Head Office and Branch dashboard views.
  4. Built a dedicated "Live Operations & Unpaid Bills" banner and pipeline metrics strip on the dashboard, displaying the count and amount of served unpaid tickets awaiting cashier collection, in-kitchen cooking counts, and total in-flight pipeline, with one-click "Collect at POS" shortcuts.
  5. Enhanced `generateFinancialSummary` in `financialService.ts` and `/api/financial/reports/head-office-summary` to aggregate `activeOrdersCount`, `servedUnpaidCount`, and `unpaidAmount` across branches.
  6. Replaced hardcoded green order badges with contextual dynamic status badges (`Served (Unpaid)`, `Paid & Completed`, `Kitchen Cooking`, `Ready in Kitchen`, `Cancelled`).
  7. Added automated integration test `Multi-Device Step 2b` in `multidevice_and_full_crud.test.ts`. All 43 tests pass cleanly.
- Decision 19: Built complete Staff & Roles editing architecture in StaffManagement.tsx and restaurant.routes.ts: added comprehensive Edit Employee modal (name, email/username login, password, system role, assigned branch, and active status), quick Password Reset modal with secure password generator and visibility toggle, and one-click Active/Inactive status toggle; updated backend PUT /api/restaurant/users/:id to hash passwords securely, enforce tenant-scoped email uniqueness, and block self-deactivation; added soft deactivation via DELETE /api/restaurant/users/:id; added CRUD 5 test to multidevice_and_full_crud.test.ts verifying full credential lifecycle; and verified all 42 tests pass.
- Decision 18: Optimized Menu Catalog product creation and editing modal (`MenuCatalog.tsx`): added editable Product Cost Price input with currency symbol and precision step support, added 1-click recipe cost synchronization button (`Sync Recipe Cost`), built live real-time profitability card (displaying effective unit cost, gross profit per unit, and color-coded margin percentage), and ensured final cost price persists accurately to PostgreSQL upon save. Table product listing prioritizes explicit product cost price.
- Decision 18: Optimized Menu Catalog product creation and editing modal (`MenuCatalog.tsx`): added editable Product Cost Price input with currency symbol and precision step support, added 1-click recipe cost synchronization button (`Sync Recipe Cost`), built live real-time profitability card (displaying effective unit cost, gross profit per unit, and color-coded margin percentage), and ensured final cost price persists accurately to PostgreSQL upon save. Table product listing prioritizes explicit product cost price.
- Decision 17: Created comprehensive integration test suite `backend/test/multidevice_and_full_crud.test.ts` covering multi-device real-time flow: Waiter places Dine-In order with product variant, addons, and cooking instructions; KDS receives ticket with modifiers summary and advances status through PENDING -> ACCEPTED -> PREPARING -> READY -> SERVED with ORDER_STATUS_CHANGED sync event; Cashier sees served order in unpaid active drawer, settles payment via cash with change, deducts exact FIFO batch stock, releases table back to AVAILABLE, and prints multi-template receipt. Verified full CRUD operations across categories, sub-categories, addon groups, inward purchases, suppliers, and recipes. All 41 monorepo tests pass.
- Decision 16: Implemented 5 distinct bill printing templates in `ReceiptModal.tsx`: Standard 80mm POS thermal receipt, Fine Dining Guest Check with tip guide and signature line, Compact 58mm mobile/kiosk slip, Official Commercial GST Tax Invoice in full A4 format, and Kitchen Order / Pickup Token. Added live print options toggles (bilingual Urdu, QR code verification, STRN/NTN tax number, tip guide), instant WhatsApp/SMS clipboard formatting, universal print CSS isolation in `index.css`, default template selection in `RestaurantSettings.tsx`, and enriched `GET /api/orders/:id/receipt` payload with full customer, server, and dining scope details.
- Streamlined Workspace Hub (`/hub`) to display exclusively the 3 core operations terminals: Dashboard, POS Terminal, and Kitchen Terminal in a clean 3-column layout.
- Implemented Menu Sub-Categories support in backend categories API, Menu Catalog management, and POS Terminal with two-tier category and sub-category chips.
- Implemented Addons & Modifiers system (extra sauces, dips, cheeses, upgrades) with dedicated Addons catalog management, interactive POS "Customize Order Item / Addons" modal with cooking note chips and live pricing, cart item addon badges, and KDS addon summary alerts for kitchen staff.
- Decision f4a8b291: Implemented dedicated Purchases Management UI (`/app/purchases`) with supplier ledger, purchase invoices, line items, and instant stock receiving into active FIFO lots with weighted cost recalculation.
- Decision f4a8b291: Upgraded Menu Catalog with embedded recipe ingredient cost calculator, profit margin percentage badges, and dedicated Menu Categories management tab.
- Decision f4a8b291: Enhanced KDS with Active Cooking vs Served vs All status filter tabs and multi-branch view.
- Decision c3b4e912: Created migration `007_multi_branch_transfers.sql` and seeded multi-branch architecture (Gulberg Main & DHA Phase 5).
- Decision c3b4e912: Implemented transactional inter-branch stock transfers with FIFO receipt lots (`/api/inventory/transfers`).
- Decision c3b4e912: Implemented Head Office consolidated dashboard with branch matrix comparison (`/api/financial/reports/head-office-summary`).
- Decision c3b4e912: Added registered multi-device terminal management in Restaurant Settings.
- Decision c3b4e912: Enhanced KDS with Web Audio chime, preparation elapsed timers, and delayed order warnings.
- Decision c3b4e912: Added POS special cooking notes, table transfers, and offline order queueing with auto-sync.
