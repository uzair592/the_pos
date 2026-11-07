import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { query } from '../src/db/connection.js';

describe('Expense Management & Financial Integration End-to-End Test Suite', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let cashierToken: string;
  let tenantId: string;
  let branchId: string;
  let testBankAccountId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Reset any lingering active device sessions for testing
    await query("DELETE FROM active_device_sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE email = 'owner@lahorekarahi.com')", [], { isSuperAdmin: true });

    // 1. Login as restaurant owner (Lahore Karahi)
    const ownerLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'owner@lahorekarahi.com',
        password: 'Password123!',
        deviceFingerprint: 'test-device-expense-owner',
        deviceName: 'Admin PC',
      },
    });

    assert.strictEqual(ownerLoginRes.statusCode, 200);
    const ownerBody = JSON.parse(ownerLoginRes.payload);
    ownerToken = ownerBody.token;
    tenantId = ownerBody.user.tenantId;
    branchId = ownerBody.user.branchId;

    // 2. Login as cashier (Lahore Karahi)
    const cashierLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'cashier@lahorekarahi.com',
        password: 'Password123!',
        deviceFingerprint: 'test-device-expense-cashier',
        deviceName: 'POS Terminal',
      },
    });

    assert.strictEqual(cashierLoginRes.statusCode, 200);
    const cashierBody = JSON.parse(cashierLoginRes.payload);
    cashierToken = cashierBody.token;

    // 3. Ensure a test bank account exists for bank expense deduction test
    const { rows: bankRows } = await query(
      `
      INSERT INTO bank_accounts (tenant_id, bank_name, account_name, account_number, current_balance, is_active)
      VALUES ($1, 'Habib Bank Limited', 'Operations Account', 'HBL-EXP-001', 500000.00, true)
      RETURNING id, current_balance
      `,
      [tenantId],
      { tenantId }
    );
    testBankAccountId = bankRows[0].id;
  });

  afterAll(async () => {
    if (testBankAccountId) {
      await query('DELETE FROM expenses WHERE bank_account_id = $1', [testBankAccountId], { tenantId });
      await query('DELETE FROM bank_accounts WHERE id = $1', [testBankAccountId], { tenantId });
    }
    await app.close();
  });

  it('1. GET /api/financial/expenses/categories seeds and returns all 9 core categories', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/financial/expenses/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert(Array.isArray(body.categories));
    assert(body.categories.length >= 9);

    const names = body.categories.map((c: any) => c.name);
    assert(names.includes('Staff Salaries'), 'Must contain Staff Salaries');
    assert(names.includes('Restaurant Rent'), 'Must contain Restaurant Rent');
    assert(names.includes('Electricity & Gas Bills'), 'Must contain Electricity & Gas Bills');
    assert(names.includes('Water Bills'), 'Must contain Water Bills');
    assert(names.includes('Crockery & Kitchen Equipment'), 'Must contain Crockery & Kitchen Equipment');
    assert(names.includes('Repairs & Maintenance'), 'Must contain Repairs & Maintenance');
    assert(names.includes('Cleaning Supplies'), 'Must contain Cleaning Supplies');
    assert(names.includes('Transportation & Fuel'), 'Must contain Transportation & Fuel');
    assert(names.includes('Miscellaneous Expenses'), 'Must contain Miscellaneous Expenses');
  });

  it('2. POST /api/financial/expenses records cash expense with title, category, paid_to, notes', async () => {
    // Get category id for Crockery
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/financial/expenses/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const categories = JSON.parse(catRes.payload).categories;
    const crockeryCat = categories.find((c: any) => c.name.includes('Crockery')) || categories[0];

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/financial/expenses',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        categoryId: crockeryCat.id,
        title: 'New Melamine Serving Plates (50 pcs)',
        amount: 15000,
        paymentMethod: 'CASH',
        paidTo: 'Shah Alam Market Wholesaler',
        notes: 'Invoice #SA-9921, replacement for broken plates',
        expenseDate: new Date().toISOString().split('T')[0],
      },
    });

    assert.strictEqual(createRes.statusCode, 201);
    const created = JSON.parse(createRes.payload).expense;
    assert.strictEqual(created.title, 'New Melamine Serving Plates (50 pcs)');
    assert.strictEqual(Number(created.amount), 15000);
    assert.strictEqual(created.payment_method, 'CASH');
    assert.strictEqual(created.paid_to, 'Shah Alam Market Wholesaler');
    assert.strictEqual(created.notes, 'Invoice #SA-9921, replacement for broken plates');
  });

  it('3. POST /api/financial/expenses records bank expense and deducts bank account balance', async () => {
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/financial/expenses/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const categories = JSON.parse(catRes.payload).categories;
    const rentCat = categories.find((c: any) => c.name.includes('Rent')) || categories[0];

    // Check bank account balance before
    const { rows: beforeRows } = await query(
      'SELECT current_balance FROM bank_accounts WHERE id = $1',
      [testBankAccountId],
      { tenantId }
    );
    const balanceBefore = Number(beforeRows[0].current_balance);

    const expenseAmount = 75000;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/financial/expenses',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        categoryId: rentCat.id,
        title: 'Main Branch Building Rent - November 2026',
        amount: expenseAmount,
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: testBankAccountId,
        paidTo: 'Building Landlord (Malik Tariq)',
        notes: 'Online IBFT transfer ref #90823412',
        expenseDate: new Date().toISOString().split('T')[0],
      },
    });

    assert.strictEqual(createRes.statusCode, 201);

    // Verify balance after deduction
    const { rows: afterRows } = await query(
      'SELECT current_balance FROM bank_accounts WHERE id = $1',
      [testBankAccountId],
      { tenantId }
    );
    const balanceAfter = Number(afterRows[0].current_balance);
    assert.strictEqual(balanceAfter, balanceBefore - expenseAmount);
  });

  it('4. PUT & DELETE /api/financial/expenses/:id allows editing and deleting with bank balance restoration', async () => {
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/financial/expenses/categories',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const categories = JSON.parse(catRes.payload).categories;
    const salaryCat = categories.find((c: any) => c.name.includes('Salaries')) || categories[0];

    // 1. Create an expense to edit/delete
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/financial/expenses',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        branchId,
        categoryId: salaryCat.id,
        title: 'Advance Salary - Dishwasher Hamza',
        amount: 8000,
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: testBankAccountId,
        paidTo: 'Hamza Kitchen Staff',
        notes: 'Advance request approved',
        expenseDate: new Date().toISOString().split('T')[0],
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const expId = JSON.parse(createRes.payload).expense.id;

    // 2. Edit the expense amount from 8000 to 10000
    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/financial/expenses/${expId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        amount: 10000,
        title: 'Advance Salary - Dishwasher Hamza (Adjusted)',
      },
    });
    assert.strictEqual(editRes.statusCode, 200);
    const updated = JSON.parse(editRes.payload).expense;
    assert.strictEqual(Number(updated.amount), 10000);
    assert.strictEqual(updated.title, 'Advance Salary - Dishwasher Hamza (Adjusted)');

    // 3. Delete the expense
    const { rows: preDeleteBank } = await query(
      'SELECT current_balance FROM bank_accounts WHERE id = $1',
      [testBankAccountId],
      { tenantId }
    );
    const preDeleteBalance = Number(preDeleteBank[0].current_balance);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/financial/expenses/${expId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(deleteRes.statusCode, 200);

    // Verify bank account was credited back the 10000
    const { rows: postDeleteBank } = await query(
      'SELECT current_balance FROM bank_accounts WHERE id = $1',
      [testBankAccountId],
      { tenantId }
    );
    const postDeleteBalance = Number(postDeleteBank[0].current_balance);
    assert.strictEqual(postDeleteBalance, preDeleteBalance + 10000);
  });

  it('5. Financial Integration: Daybook, Cash & Bank, and P&L reflect expenses', async () => {
    // A. Daybook check
    const today = new Date().toISOString().split('T')[0];
    const daybookRes = await app.inject({
      method: 'GET',
      url: `/api/financial/daybook?date=${today}&branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(daybookRes.statusCode, 200);
    const daybook = JSON.parse(daybookRes.payload).daybook;
    assert(daybook.summary.totalExpensesAmount > 0, 'Daybook summary must count recorded expenses');
    assert(daybook.expenses.length > 0, 'Daybook expenses array must contain recorded expenses');

    // B. Cash & Bank summary check
    const cashBankRes = await app.inject({
      method: 'GET',
      url: `/api/financial/cash-bank/summary?branchId=${branchId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(cashBankRes.statusCode, 200);
    const cb = JSON.parse(cashBankRes.payload).summary;
    assert(cb.todayCashExpenses !== undefined, 'Cash & Bank summary must have todayCashExpenses');
    assert(cb.todayBankExpenses !== undefined, 'Cash & Bank summary must have todayBankExpenses');

    // C. P&L financial summary check
    const plRes = await app.inject({
      method: 'GET',
      url: `/api/financial/reports/summary?branchId=${branchId}&startDate=${today}&endDate=${today}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(plRes.statusCode, 200);
    const pl = JSON.parse(plRes.payload).report;
    assert(pl.totalExpenses > 0, 'P&L report must aggregate total operating expenses');
  });

  it('6. Permissions: Cashier without EXPENSES_MANAGE cannot record or delete expenses', async () => {
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/financial/expenses/categories',
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    const categories = JSON.parse(catRes.payload).categories;

    const unauthorizedCreate = await app.inject({
      method: 'POST',
      url: '/api/financial/expenses',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        branchId,
        categoryId: categories[0].id,
        title: 'Unauthorized Cashier Expense',
        amount: 500,
        paymentMethod: 'CASH',
      },
    });

    // Cashier role does not have EXPENSES_MANAGE permission
    assert.strictEqual(unauthorizedCreate.statusCode, 403);
  });
});
