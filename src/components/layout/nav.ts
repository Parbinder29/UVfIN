import { BarChart3, FileClock, LayoutDashboard, TrendingUp, Users, Wallet } from 'lucide-react'

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/money-spent', label: 'Money Spent', icon: Wallet },
  { href: '/earnings', label: 'Earnings', icon: TrendingUp },
  { href: '/investments', label: 'Investments', icon: BarChart3, exact: true },
  { href: '/investments/investors', label: 'Investors', icon: Users },
  { href: '/audit-log', label: 'Audit Log', icon: FileClock },
] as const
