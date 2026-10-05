import { useNavigate } from 'react-router-dom'
import { useMyDividends } from '@/api/hooks'
import { MemberHeader } from '../MemberShell'
import { QueryState } from '@/ui/QueryState'
import { naira } from '@/lib/format'
import { BackLink, Empty } from './LoansPage'

export function DividendsPage() {
  const navigate = useNavigate()
  const { data: rows = [], isLoading, isError } = useMyDividends()
  const total = rows.filter((r) => r.status === 'posted').reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <MemberHeader title="Dividends" back={<BackLink onClick={() => navigate('/app')} />} />

      <div className="px-5 md:px-0">
        <QueryState isLoading={isLoading} isError={isError}>
          {rows.length === 0 ? (
            <Empty icon="savings" title="No dividends yet" hint="Surplus distributions will appear here." />
          ) : (
            <>
              <div className="mb-4 rounded-2xl bg-green p-5 text-paper">
                <div className="text-[13px] text-green-200">Total dividends received</div>
                <div className="mt-1 font-display text-3xl font-semibold tnum">{naira(total)}</div>
              </div>
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
                    <div>
                      <div className="font-display text-[14px] font-semibold text-ink">{r.period_label}</div>
                      <div className={`text-xs ${r.status === 'posted' ? 'text-green-bright' : 'text-muted-2'}`}>
                        {r.status === 'posted' ? 'Paid to savings' : 'Declared (draft)'}
                      </div>
                    </div>
                    <div className="font-mono text-[15px] font-semibold text-ink tnum">{naira(r.amount)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </QueryState>
      </div>
    </div>
  )
}
