import { LedgerPage } from '@/components/tables/LedgerPage'

export const metadata = { title: 'Earnings · UVfIN' }

export default async function EarningsPage(props: PageProps<'/earnings'>) {
  return <LedgerPage ledger="earnings" searchParams={await props.searchParams} />
}
