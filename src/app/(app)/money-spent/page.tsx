import { LedgerPage } from '@/components/tables/LedgerPage'

export const metadata = { title: 'Money Spent · UVfIN' }

export default async function MoneySpentPage(props: PageProps<'/money-spent'>) {
  return <LedgerPage ledger="expenses" searchParams={await props.searchParams} />
}
