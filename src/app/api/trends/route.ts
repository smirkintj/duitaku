import { db } from '@/db'
import { financeTransactions, financeCategories, financeSalary } from '@/db/schema'
import { and, gte, lte, desc } from 'drizzle-orm'

function padMonth(n: number) {
  return String(n).padStart(2, '0')
}

function monthsBack(anchor: string, n: number): string[] {
  const [y, m] = anchor.split('-').map(Number)
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    let mo = m - i
    let yr = y
    while (mo < 1) { mo += 12; yr-- }
    months.push(`${yr}-${padMonth(mo)}`)
  }
  return months
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const anchor = searchParams.get('m') ?? (() => {
    const now = new Date()
    return `${now.getFullYear()}-${padMonth(now.getMonth() + 1)}`
  })()
  const n = Math.min(12, Math.max(1, parseInt(searchParams.get('n') ?? '6', 10)))

  const months = monthsBack(anchor, n)

  const rangeStart = `${months[0]}-01`
  const rangeEnd = `${months[months.length - 1]}-31`

  const [transactions, categories, salaryRows] = await Promise.all([
    db
      .select({
        amount: financeTransactions.amount,
        date: financeTransactions.date,
        type: financeTransactions.type,
        categoryId: financeTransactions.categoryId,
      })
      .from(financeTransactions)
      .where(and(gte(financeTransactions.date, rangeStart), lte(financeTransactions.date, rangeEnd))),
    db.select().from(financeCategories),
    db.select().from(financeSalary).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
  ])

  const catMap = new Map(categories.map((c) => [c.id, c]))
  const salary = salaryRows[0]?.amount ?? 0

  const result = months.map((month) => {
    const [yr, mo] = month.split('-')
    const start = `${yr}-${mo}-01`
    const end = `${yr}-${mo}-31`
    const monthTxs = transactions.filter((t) => t.date >= start && t.date <= end)

    const income = monthTxs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

    const byCategoryMap = new Map<string, { id: string; name: string; icon: string; color: string; amount: number }>()
    for (const tx of monthTxs) {
      if (tx.type !== 'expense') continue
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined
      const key = tx.categoryId ?? '__none__'
      const existing = byCategoryMap.get(key)
      if (existing) {
        existing.amount += tx.amount
      } else {
        byCategoryMap.set(key, {
          id: key,
          name: cat?.name ?? 'Uncategorized',
          icon: cat?.icon ?? 'bag',
          color: cat?.color ?? '#7a7a78',
          amount: tx.amount,
        })
      }
    }

    return {
      month,
      income,
      expense,
      net: income - expense,
      byCategory: Array.from(byCategoryMap.values()).sort((a, b) => b.amount - a.amount),
    }
  })

  // Build category list sorted by total spend
  const allCategoryTotals = new Map<string, { id: string; name: string; icon: string; color: string; total: number }>()
  for (const m of result) {
    for (const c of m.byCategory) {
      const ex = allCategoryTotals.get(c.id)
      if (ex) ex.total += c.amount
      else allCategoryTotals.set(c.id, { id: c.id, name: c.name, icon: c.icon, color: c.color, total: c.amount })
    }
  }
  const topCategories = Array.from(allCategoryTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  return Response.json({ months: result, topCategories, salary })
}
