import { pgTable, text, timestamp, integer, real, boolean, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeAccounts = pgTable('finance_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().default('bank'), // cash | bank | credit
  currency: text('currency').notNull().default('MYR'),
  initialBalance: real('initial_balance').notNull().default(0),
  // CC-specific fields (null for bank/cash)
  creditLimit: real('credit_limit'),
  currentOutstanding: real('current_outstanding'),  // manually updated, total owed right now
  statementDueDay: integer('statement_due_day'),    // day of month payment is due (e.g. 15)
  statementDay: integer('statement_day'),           // day of month statement cuts (e.g. 1)
  lastFour: text('last_four'),                      // last 4 digits of card number
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeCcStatements = pgTable('finance_cc_statements', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => financeAccounts.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),                  // YYYY-MM
  statementAmount: real('statement_amount').notNull(),
  minimumPayment: real('minimum_payment').notNull().default(0),
  paidAmount: real('paid_amount').notNull().default(0),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeCategories = pgTable('finance_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('bag'),
  color: text('color').default('#a3e635'),
  type: text('type').notNull().default('expense'), // income | expense
  monthlyLimit: real('monthly_limit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeTransactions = pgTable('finance_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').references(() => financeAccounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => financeCategories.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('MYR'),
  date: text('date').notNull(), // YYYY-MM-DD
  note: text('note'),
  merchant: text('merchant'),
  type: text('type').notNull().default('expense'), // income | expense
  isRecurring: boolean('is_recurring').notNull().default(false),
  importHash: text('import_hash'), // for duplicate detection on CC import
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeSalary = pgTable('finance_salary', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),        // net take-home (used everywhere as income base)
  grossAmount: real('gross_amount'),       // gross salary before deductions
  epfEmployee: real('epf_employee').default(0),
  epfEmployer: real('epf_employer').default(0),
  socso: real('socso').default(0),
  eis: real('eis').default(0),
  pcb: real('pcb').default(0),
  otherDeductions: real('other_deductions').default(0),
  currency: text('currency').notNull().default('MYR'),
  effectiveFrom: text('effective_from').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userSettings = pgTable('user_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique(),
  celestial: boolean('celestial').notNull().default(true),
  sidebarExpanded: boolean('sidebar_expanded').notNull().default(true),
  payDay: integer('pay_day').default(1),  // day of month salary arrives (1-31)
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const financeBills = pgTable('finance_bills', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  dueDay: integer('due_day').notNull().default(1),
  categoryId: uuid('category_id').references(() => financeCategories.id, { onDelete: 'set null' }),
  icon: text('icon').notNull().default('bolt'),
  isActive: boolean('is_active').notNull().default(true),
  paymentMethod: text('payment_method').notNull().default('direct_debit'), // direct_debit | credit_card
  accountId: uuid('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeBillPayments = pgTable('finance_bill_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  billId: uuid('bill_id').notNull().references(() => financeBills.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeBnpl = pgTable('finance_bnpl', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
  merchant: text('merchant').notNull(),
  provider: text('provider').notNull().default('shopee'),
  totalAmount: real('total_amount').notNull(),
  installmentAmount: real('installment_amount').notNull(),
  totalInstallments: integer('total_installments').notNull(),
  paidInstallments: integer('paid_installments').notNull().default(0),
  startMonth: text('start_month').notNull(),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeSavingsGoals = pgTable('finance_savings_goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: real('target_amount'),
  currentAmount: real('current_amount').notNull().default(0),
  color: text('color').default('#a3e635'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeAiInsights = pgTable('finance_ai_insights', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),   // YYYY-MM — one row per month
  data: text('data').notNull(),     // JSON string of CoachData
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
})

export const financeInvestments = pgTable('finance_investments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'epf' | 'asb' | 'versa' | 'crypto' | 'unit_trust' | 'other'
  provider: text('provider'),
  costBasis: real('cost_basis').default(0).notNull(),
  currentValue: real('current_value').default(0).notNull(),
  currency: text('currency').default('MYR').notNull(),
  units: real('units'),
  ticker: text('ticker'),
  notes: text('notes'),
  autoSync: boolean('auto_sync').default(false).notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeLoans = pgTable('finance_loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().default('other'), // car | student | personal | mortgage | other
  lender: text('lender'),
  originalAmount: real('original_amount').notNull(),
  outstandingBalance: real('outstanding_balance').notNull(),
  interestRate: real('interest_rate'),   // annual flat rate %
  monthlyInstallment: real('monthly_installment').notNull(),
  startDate: text('start_date'),         // YYYY-MM-DD
  tenureMonths: integer('tenure_months'),
  billId: uuid('bill_id').references(() => financeBills.id, { onDelete: 'set null' }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeApiKeys = pgTable('finance_api_keys', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Relations
export const financeAccountsRelations = relations(financeAccounts, ({ many }) => ({
  transactions: many(financeTransactions),
  ccStatements: many(financeCcStatements),
}))

export const financeCcStatementsRelations = relations(financeCcStatements, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [financeCcStatements.accountId],
    references: [financeAccounts.id],
  }),
}))

export const financeCategoriesRelations = relations(financeCategories, ({ many }) => ({
  transactions: many(financeTransactions),
}))

export const financeTransactionsRelations = relations(financeTransactions, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [financeTransactions.accountId],
    references: [financeAccounts.id],
  }),
  category: one(financeCategories, {
    fields: [financeTransactions.categoryId],
    references: [financeCategories.id],
  }),
}))
