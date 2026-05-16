export interface RedFlag {
  title: string
  metric: string
  detail: string
  tip: string
}

interface CategoryStats {
  name: string
  spent: number
  prior3moAvg: number
  monthlyLimit: number | null
  isSubscription?: boolean
  prevMonthTotal?: number
}

export function computeRedFlags(
  salary: number,
  remaining: number,
  categories: CategoryStats[],
  transactions: { amount: number; type: string }[],
): RedFlag[] {
  const flags: RedFlag[] = []

  // 1. Spike flags: category spent > prior3moAvg * 1.3
  for (const cat of categories) {
    if (cat.prior3moAvg > 0 && cat.spent > cat.prior3moAvg * 1.3) {
      const pct = Math.round(((cat.spent - cat.prior3moAvg) / cat.prior3moAvg) * 100)
      flags.push({
        title: `${cat.name} spike`,
        metric: `+${pct}%`,
        detail: `You've spent RM ${cat.spent.toFixed(2)} on ${cat.name} this month — ${(cat.spent / cat.prior3moAvg).toFixed(1)}× your 3-month average (RM ${cat.prior3moAvg.toFixed(2)}).`,
        tip: `Review your ${cat.name} transactions and consider setting a stricter monthly cap.`,
      })
    }
  }

  // 2. Subscription increases vs last month
  for (const cat of categories) {
    if (cat.isSubscription && cat.prevMonthTotal !== undefined && cat.prevMonthTotal > 0) {
      if (cat.spent > cat.prevMonthTotal) {
        const diff = cat.spent - cat.prevMonthTotal
        flags.push({
          title: `${cat.name} cost increased`,
          metric: `+RM ${diff.toFixed(2)}`,
          detail: `Your ${cat.name} spending rose from RM ${cat.prevMonthTotal.toFixed(2)} last month to RM ${cat.spent.toFixed(2)} this month.`,
          tip: 'Check if a subscription price increased or a new one was added.',
        })
      }
    }
  }

  // 3. Remaining < salary * 0.10
  if (salary > 0 && remaining < salary * 0.1) {
    const pct = Math.round((remaining / salary) * 100)
    flags.push({
      title: 'Low remaining balance',
      metric: `${pct}% left`,
      detail: `Only RM ${remaining.toFixed(2)} remains — less than 10% of your salary.`,
      tip: 'Pause discretionary spending for the rest of the month to avoid a deficit.',
    })
  }

  // 4. Any single transaction > salary * 0.20
  if (salary > 0) {
    const bigTx = transactions
      .filter((t) => t.type === 'expense' && t.amount > salary * 0.2)
    for (const tx of bigTx) {
      flags.push({
        title: 'Large single transaction',
        metric: `RM ${tx.amount.toFixed(2)}`,
        detail: `A single transaction of RM ${tx.amount.toFixed(2)} exceeds 20% of your monthly salary.`,
        tip: 'Verify this purchase was intentional and budgeted for.',
      })
      break // only flag once to avoid spam
    }
  }

  return flags
}
