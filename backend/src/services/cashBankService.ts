import { query, withTransaction } from '../db/connection.js';
import {
  BankAccount,
  CashBankTransfer,
  CashBankTransferType,
  CashBankSummary,
  PaymentMethod,
} from '@pos/shared';

export interface CreateBankAccountDTO {
  tenantId: string;
  accountName: string;
  bankName: string;
  accountNumber?: string;
  iban?: string;
  branchCode?: string;
  openingBalance?: number;
  isDefault?: boolean;
}

export interface UpdateBankAccountDTO {
  tenantId: string;
  id: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  branchCode?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CreateCashBankTransferDTO {
  tenantId: string;
  transferType: CashBankTransferType;
  fromBankAccountId?: string;
  toBankAccountId?: string;
  amount: number;
  transferDate?: string;
  referenceNumber?: string;
  notes?: string;
  userId: string;
}

/**
 * 1. Get All Bank Accounts for Tenant
 * Auto-seeds a default primary restaurant operating account if none exist
 */
export async function getBankAccounts(tenantId: string): Promise<BankAccount[]> {
  const { rows } = await query(
    `SELECT * FROM bank_accounts WHERE tenant_id = $1 AND is_active = true ORDER BY is_default DESC, created_at ASC`,
    [tenantId],
    { tenantId }
  );

  if (rows.length === 0) {
    // Auto-seed default primary operating bank account
    const seedRes = await query(
      `
      INSERT INTO bank_accounts (
        tenant_id, account_name, bank_name, account_number, iban, opening_balance, current_balance, is_default, is_active
      ) VALUES ($1, $2, $3, $4, $5, 0.00, 0.00, true, true)
      RETURNING *
      `,
      [tenantId, 'Restaurant Operating Account', 'Meezan Bank Ltd', '02010108928371', 'PK12MEZN0002010108928371'],
      { tenantId }
    );
    rows.push(seedRes.rows[0]);
  }

  return rows.map(mapBankAccountRow);
}

/**
 * 2. Create New Bank Account
 */
export async function createBankAccount(dto: CreateBankAccountDTO): Promise<BankAccount> {
  const {
    tenantId,
    accountName,
    bankName,
    accountNumber,
    iban,
    branchCode,
    openingBalance = 0,
    isDefault = false,
  } = dto;

  return await withTransaction(async (client) => {
    if (isDefault) {
      await client.query(
        `UPDATE bank_accounts SET is_default = false WHERE tenant_id = $1`,
        [tenantId]
      );
    }

    const { rows } = await client.query(
      `
      INSERT INTO bank_accounts (
        tenant_id, account_name, bank_name, account_number, iban, branch_code,
        opening_balance, current_balance, is_default, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, true)
      RETURNING *
      `,
      [
        tenantId,
        accountName,
        bankName,
        accountNumber || null,
        iban || null,
        branchCode || null,
        openingBalance,
        isDefault,
      ]
    );

    return mapBankAccountRow(rows[0]);
  }, { tenantId });
}

/**
 * 3. Update Existing Bank Account
 */
export async function updateBankAccount(dto: UpdateBankAccountDTO): Promise<BankAccount> {
  const {
    tenantId,
    id,
    accountName,
    bankName,
    accountNumber,
    iban,
    branchCode,
    isDefault,
    isActive,
  } = dto;

  return await withTransaction(async (client) => {
    if (isDefault) {
      await client.query(
        `UPDATE bank_accounts SET is_default = false WHERE tenant_id = $1 AND id != $2`,
        [tenantId, id]
      );
    }

    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [id, tenantId];

    if (accountName !== undefined) {
      params.push(accountName);
      fields.push(`account_name = $${params.length}`);
    }
    if (bankName !== undefined) {
      params.push(bankName);
      fields.push(`bank_name = $${params.length}`);
    }
    if (accountNumber !== undefined) {
      params.push(accountNumber);
      fields.push(`account_number = $${params.length}`);
    }
    if (iban !== undefined) {
      params.push(iban);
      fields.push(`iban = $${params.length}`);
    }
    if (branchCode !== undefined) {
      params.push(branchCode);
      fields.push(`branch_code = $${params.length}`);
    }
    if (isDefault !== undefined) {
      params.push(isDefault);
      fields.push(`is_default = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(isActive);
      fields.push(`is_active = $${params.length}`);
    }

    const { rows } = await client.query(
      `
      UPDATE bank_accounts
      SET ${fields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
      `,
      params
    );

    if (rows.length === 0) {
      throw new Error('Bank account not found');
    }

    return mapBankAccountRow(rows[0]);
  }, { tenantId });
}

/**
 * 4. Execute Internal Fund Transfer (Cash to Bank / Bank to Cash / Bank to Bank)
 */
export async function createCashBankTransfer(dto: CreateCashBankTransferDTO): Promise<CashBankTransfer> {
  const {
    tenantId,
    transferType,
    fromBankAccountId,
    toBankAccountId,
    amount,
    transferDate,
    referenceNumber,
    notes,
    userId,
  } = dto;

  if (amount <= 0) {
    throw new Error('Transfer amount must be greater than zero');
  }

  return await withTransaction(async (client) => {
    // A. Cash to Bank (Cash Deposit)
    if (transferType === CashBankTransferType.CASH_TO_BANK) {
      if (!toBankAccountId) {
        throw new Error('Destination bank account is required for Cash to Bank transfer');
      }

      await client.query(
        `
        UPDATE bank_accounts
        SET current_balance = current_balance + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND tenant_id = $3
        `,
        [amount, toBankAccountId, tenantId]
      );
    }
    // B. Bank to Cash (Cash Withdrawal)
    else if (transferType === CashBankTransferType.BANK_TO_CASH) {
      if (!fromBankAccountId) {
        throw new Error('Source bank account is required for Bank to Cash withdrawal');
      }

      await client.query(
        `
        UPDATE bank_accounts
        SET current_balance = current_balance - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND tenant_id = $3
        `,
        [amount, fromBankAccountId, tenantId]
      );
    }
    // C. Bank to Bank (Internal Transfer)
    else if (transferType === CashBankTransferType.BANK_TO_BANK) {
      if (!fromBankAccountId || !toBankAccountId) {
        throw new Error('Both source and destination bank accounts are required for Bank to Bank transfer');
      }
      if (fromBankAccountId === toBankAccountId) {
        throw new Error('Source and destination bank accounts cannot be the same');
      }

      await client.query(
        `
        UPDATE bank_accounts
        SET current_balance = current_balance - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND tenant_id = $3
        `,
        [amount, fromBankAccountId, tenantId]
      );

      await client.query(
        `
        UPDATE bank_accounts
        SET current_balance = current_balance + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND tenant_id = $3
        `,
        [amount, toBankAccountId, tenantId]
      );
    }

    // Insert Transfer Log
    const { rows } = await client.query(
      `
      INSERT INTO cash_bank_transfers (
        tenant_id, transfer_type, from_bank_account_id, to_bank_account_id,
        amount, transfer_date, reference_number, notes, recorded_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8, $9)
      RETURNING *
      `,
      [
        tenantId,
        transferType,
        fromBankAccountId || null,
        toBankAccountId || null,
        amount,
        transferDate || null,
        referenceNumber || null,
        notes || null,
        userId,
      ]
    );

    return mapTransferRow(rows[0]);
  }, { tenantId });
}

/**
 * 5. Get Cash and Bank Summary (Total Cash In Hand, Bank Balances, Liquid Funds, Today's Flows)
 */
export async function getCashBankSummary(tenantId: string, targetDate?: string): Promise<CashBankSummary> {
  const dNow = new Date();
  const dateStr = targetDate || `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
  const startOfDay = `${dateStr} 00:00:00.000`;
  const endOfDay = `${dateStr} 23:59:59.999`;

  // 1. Bank Accounts and their balances
  const accounts = await getBankAccounts(tenantId);
  const totalBankBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  // 2. All-Time Cumulative Cash In Hand:
  // Total Cash Sales from completed orders
  const cashSalesRes = await query(
    `
    SELECT COALESCE(SUM(op.amount - op.change_amount), 0)::numeric as total_cash_sales
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    WHERE op.tenant_id = $1 AND op.method = 'CASH' AND o.status != 'CANCELLED'
    `,
    [tenantId],
    { tenantId }
  );
  const totalCashSales = Number(cashSalesRes.rows[0]?.total_cash_sales || 0);

  // Total Cash Deposited to Bank (CASH_TO_BANK)
  const cashDepositsRes = await query(
    `
    SELECT COALESCE(SUM(amount), 0)::numeric as total_cash_deposits
    FROM cash_bank_transfers
    WHERE tenant_id = $1 AND transfer_type = 'CASH_TO_BANK'
    `,
    [tenantId],
    { tenantId }
  );
  const totalCashDeposited = Number(cashDepositsRes.rows[0]?.total_cash_deposits || 0);

  // Total Bank Withdrawals into Cash (BANK_TO_CASH)
  const cashWithdrawalsRes = await query(
    `
    SELECT COALESCE(SUM(amount), 0)::numeric as total_cash_withdrawals
    FROM cash_bank_transfers
    WHERE tenant_id = $1 AND transfer_type = 'BANK_TO_CASH'
    `,
    [tenantId],
    { tenantId }
  );
  const totalCashWithdrawn = Number(cashWithdrawalsRes.rows[0]?.total_cash_withdrawals || 0);

  // Total Cash Expenses
  const cashExpensesRes = await query(
    `
    SELECT COALESCE(SUM(amount), 0)::numeric as total_cash_expenses
    FROM expenses
    WHERE tenant_id = $1 AND payment_method = 'CASH'
    `,
    [tenantId],
    { tenantId }
  );
  const totalCashExpenses = Number(cashExpensesRes.rows[0]?.total_cash_expenses || 0);

  // Net Cash in Hand
  const totalCashInHand = Math.max(0, totalCashSales + totalCashWithdrawn - totalCashDeposited - totalCashExpenses);
  const totalLiquidFunds = totalCashInHand + totalBankBalance;

  // 3. Today's Specific Inflows & Outflows:
  // Today's Cash Sales
  const todayCashSalesRes = await query(
    `
    SELECT COALESCE(SUM(op.amount - op.change_amount), 0)::numeric as today_cash
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    WHERE op.tenant_id = $1 AND op.method = 'CASH' AND o.status != 'CANCELLED'
      AND op.paid_at >= $2::timestamptz AND op.paid_at <= $3::timestamptz
    `,
    [tenantId, startOfDay, endOfDay],
    { tenantId }
  );
  const todayCashSales = Number(todayCashSalesRes.rows[0]?.today_cash || 0);

  // Today's Bank Sales (Card, Bank Transfer, Digital Wallet)
  const todayBankSalesRes = await query(
    `
    SELECT COALESCE(SUM(op.amount), 0)::numeric as today_bank
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    WHERE op.tenant_id = $1 AND op.method IN ('CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET') AND o.status != 'CANCELLED'
      AND op.paid_at >= $2::timestamptz AND op.paid_at <= $3::timestamptz
    `,
    [tenantId, startOfDay, endOfDay],
    { tenantId }
  );
  const todayBankSales = Number(todayBankSalesRes.rows[0]?.today_bank || 0);

  // Today's Cash Transferred to Bank
  const todayDepositsRes = await query(
    `
    SELECT COALESCE(SUM(amount), 0)::numeric as today_deposits
    FROM cash_bank_transfers
    WHERE tenant_id = $1 AND transfer_type = 'CASH_TO_BANK'
      AND transfer_date = $2::date
    `,
    [tenantId, dateStr],
    { tenantId }
  );
  const todayCashDepositedToBank = Number(todayDepositsRes.rows[0]?.today_deposits || 0);

  // Today's Bank Withdrawn to Cash
  const todayWithdrawalsRes = await query(
    `
    SELECT COALESCE(SUM(amount), 0)::numeric as today_withdrawals
    FROM cash_bank_transfers
    WHERE tenant_id = $1 AND transfer_type = 'BANK_TO_CASH'
      AND transfer_date = $2::date
    `,
    [tenantId, dateStr],
    { tenantId }
  );
  const todayBankWithdrawnToCash = Number(todayWithdrawalsRes.rows[0]?.today_withdrawals || 0);

  // Today's Expenses
  const todayExpensesRes = await query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount ELSE 0 END), 0)::numeric as cash_exp,
      COALESCE(SUM(CASE WHEN payment_method != 'CASH' THEN amount ELSE 0 END), 0)::numeric as bank_exp
    FROM expenses
    WHERE tenant_id = $1 AND expense_date = $2::date
    `,
    [tenantId, dateStr],
    { tenantId }
  );
  const todayCashExpenses = Number(todayExpensesRes.rows[0]?.cash_exp || 0);
  const todayBankExpenses = Number(todayExpensesRes.rows[0]?.bank_exp || 0);

  return {
    totalCashInHand,
    totalBankBalance,
    totalLiquidFunds,
    todayCashSales,
    todayBankSales,
    todayCashDepositedToBank,
    todayBankWithdrawnToCash,
    todayCashExpenses,
    todayBankExpenses,
    bankAccounts: accounts,
  };
}

/**
 * 6. Get List of Cash & Bank Transfers
 */
export async function getCashBankTransfers(
  tenantId: string,
  filters: { startDate?: string; endDate?: string; transferType?: string }
): Promise<CashBankTransfer[]> {
  const { startDate, endDate, transferType } = filters;
  const params: any[] = [tenantId];
  let sql = `
    SELECT
      t.*,
      fa.account_name as from_account_name,
      fa.bank_name as from_bank_name,
      ta.account_name as to_account_name,
      ta.bank_name as to_bank_name,
      u.full_name as recorded_by_name
    FROM cash_bank_transfers t
    LEFT JOIN bank_accounts fa ON fa.id = t.from_bank_account_id
    LEFT JOIN bank_accounts ta ON ta.id = t.to_bank_account_id
    LEFT JOIN users u ON u.id = t.recorded_by_user_id
    WHERE t.tenant_id = $1
  `;

  if (startDate) {
    params.push(startDate);
    sql += ` AND t.transfer_date >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    sql += ` AND t.transfer_date <= $${params.length}`;
  }
  if (transferType && transferType !== 'ALL') {
    params.push(transferType);
    sql += ` AND t.transfer_type = $${params.length}`;
  }

  sql += ` ORDER BY t.created_at DESC, t.transfer_date DESC`;

  const { rows } = await query(sql, params, { tenantId });
  return rows.map((r) => ({
    ...mapTransferRow(r),
    fromAccountName: r.from_account_name ? `${r.from_bank_name} - ${r.from_account_name}` : 'Cash in Hand (Drawer)',
    toAccountName: r.to_account_name ? `${r.to_bank_name} - ${r.to_account_name}` : 'Cash in Hand (Drawer)',
    recordedByName: r.recorded_by_name || 'Staff Member',
  }));
}

/**
 * 7. Unified Chronological Cash & Bank Ledger Statement
 */
export async function getCashBankLedger(
  tenantId: string,
  filters: { accountId?: string; startDate?: string; endDate?: string }
): Promise<any[]> {
  const { accountId, startDate, endDate } = filters;

  // We unify: 1) Order Payments, 2) Cash/Bank Transfers, 3) Expenses
  const items: any[] = [];

  // A. Order Collections
  let ordersSql = `
    SELECT
      op.id,
      op.paid_at as transaction_date,
      op.amount,
      op.method as payment_method,
      op.reference,
      op.bank_account_id,
      ba.account_name as bank_account_name,
      ba.bank_name,
      o.order_number,
      u.full_name as recorded_by_name
    FROM order_payments op
    JOIN orders o ON o.id = op.order_id
    LEFT JOIN bank_accounts ba ON ba.id = op.bank_account_id
    LEFT JOIN users u ON u.id = op.recorded_by_user_id
    WHERE op.tenant_id = $1 AND o.status != 'CANCELLED'
  `;
  const ordersParams: any[] = [tenantId];
  if (startDate) {
    ordersParams.push(`${startDate} 00:00:00.000`);
    ordersSql += ` AND op.paid_at >= $${ordersParams.length}::timestamptz`;
  }
  if (endDate) {
    ordersParams.push(`${endDate} 23:59:59.999`);
    ordersSql += ` AND op.paid_at <= $${ordersParams.length}::timestamptz`;
  }
  const ordersRes = await query(ordersSql, ordersParams, { tenantId });

  for (const o of ordersRes.rows) {
    const isCash = o.payment_method === 'CASH';
    items.push({
      id: o.id,
      date: o.transaction_date,
      type: isCash ? 'POS_CASH_SALE' : 'POS_BANK_SALE',
      typeLabel: isCash ? 'POS Cash Sale' : `POS ${o.payment_method} Sale`,
      accountName: isCash ? 'Cash in Hand' : (o.bank_account_name ? `${o.bank_name} - ${o.bank_account_name}` : 'Bank Account'),
      accountId: isCash ? 'CASH' : o.bank_account_id,
      inflow: Number(o.amount),
      outflow: 0,
      reference: o.order_number ? `Order #${o.order_number}` : o.reference,
      recordedBy: o.recorded_by_name || 'Cashier',
      notes: `Received via ${o.payment_method}`,
    });
  }

  // B. Transfers
  let transferSql = `
    SELECT
      t.*,
      fa.account_name as from_account_name,
      fa.bank_name as from_bank_name,
      ta.account_name as to_account_name,
      ta.bank_name as to_bank_name,
      u.full_name as recorded_by_name
    FROM cash_bank_transfers t
    LEFT JOIN bank_accounts fa ON fa.id = t.from_bank_account_id
    LEFT JOIN bank_accounts ta ON ta.id = t.to_bank_account_id
    LEFT JOIN users u ON u.id = t.recorded_by_user_id
    WHERE t.tenant_id = $1
  `;
  const transferParams: any[] = [tenantId];
  if (startDate) {
    transferParams.push(startDate);
    transferSql += ` AND t.transfer_date >= $${transferParams.length}`;
  }
  if (endDate) {
    transferParams.push(endDate);
    transferSql += ` AND t.transfer_date <= $${transferParams.length}`;
  }
  const transferRes = await query(transferSql, transferParams, { tenantId });

  for (const t of transferRes.rows) {
    if (t.transfer_type === 'CASH_TO_BANK') {
      items.push({
        id: `${t.id}-cash`,
        date: t.created_at,
        type: 'CASH_DEPOSIT_OUT',
        typeLabel: 'Cash Deposited to Bank',
        accountName: 'Cash in Hand',
        accountId: 'CASH',
        inflow: 0,
        outflow: Number(t.amount),
        reference: t.reference_number || 'Deposit Slip',
        recordedBy: t.recorded_by_name || 'Staff',
        notes: `Deposited into ${t.to_bank_name || 'Bank'} (${t.notes || ''})`,
      });
      items.push({
        id: `${t.id}-bank`,
        date: t.created_at,
        type: 'CASH_DEPOSIT_IN',
        typeLabel: 'Cash Deposit Received',
        accountName: t.to_account_name ? `${t.to_bank_name} - ${t.to_account_name}` : 'Bank Account',
        accountId: t.to_bank_account_id,
        inflow: Number(t.amount),
        outflow: 0,
        reference: t.reference_number || 'Deposit Slip',
        recordedBy: t.recorded_by_name || 'Staff',
        notes: `Cash transferred from Drawer (${t.notes || ''})`,
      });
    } else if (t.transfer_type === 'BANK_TO_CASH') {
      items.push({
        id: `${t.id}-bank`,
        date: t.created_at,
        type: 'BANK_WITHDRAWAL_OUT',
        typeLabel: 'Bank Withdrawal',
        accountName: t.from_account_name ? `${t.from_bank_name} - ${t.from_account_name}` : 'Bank Account',
        accountId: t.from_bank_account_id,
        inflow: 0,
        outflow: Number(t.amount),
        reference: t.reference_number || 'Cheque / Slip',
        recordedBy: t.recorded_by_name || 'Staff',
        notes: `Withdrawn to cash drawer (${t.notes || ''})`,
      });
      items.push({
        id: `${t.id}-cash`,
        date: t.created_at,
        type: 'BANK_WITHDRAWAL_IN',
        typeLabel: 'Bank Cash Replenishment',
        accountName: 'Cash in Hand',
        accountId: 'CASH',
        inflow: Number(t.amount),
        outflow: 0,
        reference: t.reference_number || 'Cheque / Slip',
        recordedBy: t.recorded_by_name || 'Staff',
        notes: `Received from ${t.from_bank_name || 'Bank'} (${t.notes || ''})`,
      });
    }
  }

  // C. Expenses
  let expSql = `
    SELECT
      e.*,
      ba.account_name as bank_account_name,
      ba.bank_name,
      ec.name as category_name,
      u.full_name as recorded_by_name
    FROM expenses e
    LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN users u ON u.id = e.recorded_by_user_id
    WHERE e.tenant_id = $1
  `;
  const expParams: any[] = [tenantId];
  if (startDate) {
    expParams.push(startDate);
    expSql += ` AND e.expense_date >= $${expParams.length}::date`;
  }
  if (endDate) {
    expParams.push(endDate);
    expSql += ` AND e.expense_date <= $${expParams.length}::date`;
  }
  const expRes = await query(expSql, expParams, { tenantId });

  for (const e of expRes.rows) {
    const isCash = e.payment_method === 'CASH';
    items.push({
      id: e.id,
      date: e.created_at,
      type: isCash ? 'EXPENSE_CASH' : 'EXPENSE_BANK',
      typeLabel: isCash ? 'Cash Expense' : 'Bank Expense',
      accountName: isCash ? 'Cash in Hand' : (e.bank_account_name ? `${e.bank_name} - ${e.bank_account_name}` : 'Bank Account'),
      accountId: isCash ? 'CASH' : e.bank_account_id,
      inflow: 0,
      outflow: Number(e.amount),
      reference: e.category_name,
      recordedBy: e.recorded_by_name || 'Staff',
      notes: e.description,
    });
  }

  // Filter by account if requested
  let filtered = items;
  if (accountId && accountId !== 'ALL') {
    filtered = items.filter((it) => it.accountId === accountId);
  }

  // Sort chronologically descending
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return filtered;
}

// Helpers
function mapBankAccountRow(r: any): BankAccount {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    accountName: r.account_name,
    bankName: r.bank_name,
    accountNumber: r.account_number,
    iban: r.iban,
    branchCode: r.branch_code,
    openingBalance: Number(r.opening_balance || 0),
    currentBalance: Number(r.current_balance || 0),
    isDefault: Boolean(r.is_default),
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapTransferRow(r: any): CashBankTransfer {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    transferType: r.transfer_type as CashBankTransferType,
    fromBankAccountId: r.from_bank_account_id,
    toBankAccountId: r.to_bank_account_id,
    amount: Number(r.amount),
    transferDate: r.transfer_date,
    referenceNumber: r.reference_number,
    notes: r.notes,
    recordedByUserId: r.recorded_by_user_id,
    createdAt: r.created_at,
  };
}
