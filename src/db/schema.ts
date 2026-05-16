import { pgTable, text, timestamp, integer, real, boolean, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const financeAccounts = pgTable('finance_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('bank'), // cash | bank | credit
  currency: text('currency').notNull().default('MYR'),
  initialBalance: real('initial_balance').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeCategories = pgTable('finance_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('bag'),
  color: text('color').default('#a3e635'),
  type: text('type').notNull().default('expense'), // income | expense
  monthlyLimit: real('monthly_limit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const financeTransactions = pgTable('finance_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
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
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('MYR'),
  effectiveFrom: text('effective_from').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userSettings = pgTable('user_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  celestial: boolean('celestial').notNull().default(true),
  sidebarExpanded: boolean('sidebar_expanded').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Relations
export const financeAccountsRelations = relations(financeAccounts, ({ many }) => ({
  transactions: many(financeTransactions),
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
