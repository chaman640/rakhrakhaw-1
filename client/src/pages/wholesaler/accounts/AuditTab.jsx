import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, CheckCircle2, AlertTriangle, XCircle, Info, ChevronDown, ChevronRight, ShieldCheck, ExternalLink,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Badge, Modal, Spinner, EmptyState,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import {
  Amt, DateRange, Toolbar, today, fyStart, dateLabel,
} from './accShared';

const Row = ({ k, v }) => (v === undefined || v === null || v === '' ? null : <div className="flex justify-between gap-3 py-1 text-sm"><dt className="text-slate-500">{t(k)}</dt><dd className="text-right text-slate-900">{v}</dd></div>);

/** One transaction, the way a CA checks it */
export function VerifyModal({ target, onClose }) {
  const { data: d, loading, error } = useQuery(['acc', 'verify', target?.type, target?.id], () => api.get(`/accounts/verify/${target.type}/${target.id}`).then((x) => x.data), { enabled: Boolean(target), poll: false });
  return (
    <Modal open={Boolean(target)} onClose={onClose} size="lg" title={d ? `${t(d.label)} ${d.no}` : t('Transaction')}>
      {error && !d ? <p className="py-8 text-center text-sm text-slate-500">{error.message}</p> : loading || !d ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <div className="space-y-4">
          {d.warnings.length > 0 && (
            <div className="space-y-1 rounded-lg bg-amber-50 p-3">
              {d.warnings.map((w) => <p key={w.key} className="flex items-center gap-2 text-sm text-amber-900"><AlertTriangle size={14} />{t(w.text)}</p>)}
            </div>
          )}
          <dl className="grid gap-x-6 sm:grid-cols-2">
            <div>
              <Row k="Date" v={dateLabel(d.date)} />
              <Row k="Created by" v={d.createdBy ? `${d.createdBy.name} (${d.createdBy.role})` : '—'} />
              <Row k="Created at" v={formatDateTime(d.createdAt)} />
              {d.updatedAt !== d.createdAt && <Row k="Last changed" v={formatDateTime(d.updatedAt)} />}
            </div>
            <div>
              <Row k="Party" v={d.party ? `${d.party.name}${d.party.gstin ? ` · ${d.party.gstin}` : ''}` : null} />
              <Row k="Amount" v={<Amt v={d.amount} strong />} />
              {d.tax > 0 && <Row k="GST" v={<>
                <Amt v={d.tax} /> {d.taxSplit.igst ? `(IGST)` : d.taxSplit.cgst ? `(CGST ${d.taxSplit.cgst} + SGST ${d.taxSplit.sgst})` : ''}
              </>} />}
              {d.profit && <Row k="Gross profit" v={<><Amt v={d.profit.gross} strong /> <span className="text-xs text-slate-500">({t('cost')} {d.profit.cost})</span></>} />}
            </div>
          </dl>
          {d.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-2 py-1.5">{t('Item')}</th><th>HSN</th><th className="text-right">{t('Qty')}</th><th className="text-right">{t('Rate')}</th><th className="text-right">GST</th><th className="text-right">{t('Total')}</th>{d.profit && <th className="px-2 text-right">{t('Cost')}</th>}</tr></thead>
                <tbody>{d.lines.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1.5">{l.name}</td><td>{l.hsn}</td><td className="text-right">{l.qty} {l.unit}</td><td className="text-right"><Amt v={l.rate} /></td><td className="text-right">{l.gstRate}%</td><td className="text-right"><Amt v={l.total} /></td>{d.profit && <td className="px-2 text-right"><Amt v={l.cost} /></td>}</tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div>
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">{t('Ledger postings')} {d.balanced ? <Badge tone="green">{t('Balanced')}</Badge> : <Badge tone="red">{t('Not balanced')}</Badge>}</p>
            <table className="w-full text-xs"><tbody>
              {d.postings.map((l, i) => (
                <tr key={i} className="border-t border-slate-100 text-slate-700"><td className="py-1">{l.cr ? <span className="pl-6">{t('To')} {l.name}</span> : l.name}</td><td className="w-28 text-right">{l.dr ? <Amt v={l.dr} /> : ''}</td><td className="w-28 text-right">{l.cr ? <Amt v={l.cr} /> : ''}</td></tr>
              ))}
            </tbody></table>
          </div>
          {d.payments.length > 0 && (
            <div><p className="mb-1 text-sm font-semibold text-slate-900">{t('Payments against it')}</p>
              <ul className="text-xs text-slate-700">{d.payments.map((p) => <li key={p._id} className="flex justify-between border-t border-slate-100 py-1"><span>{p.no} · {dateLabel(p.date)} · {p.mode}{p.status !== 'confirmed' ? ` · ${p.status}` : ''}</span><Amt v={p.amount} /></li>)}</ul>
            </div>
          )}
          {d.stock.length > 0 && (
            <div><p className="mb-1 text-sm font-semibold text-slate-900">{t('Stock effect')}</p>
              <ul className="text-xs text-slate-700">{d.stock.map((s, i) => <li key={i} className="flex justify-between border-t border-slate-100 py-1"><span>{s.item}</span><span className={s.qty < 0 ? 'text-red-600' : 'text-emerald-700'}>{s.qty > 0 ? '+' : ''}{s.qty} {s.unit} → {s.balanceAfter}</span></li>)}</ul>
            </div>
          )}
          <div><p className="mb-1 text-sm font-semibold text-slate-900">{t('Edit history')}</p>
            {!d.history.length ? <p className="text-xs text-slate-500">{t('No changes recorded')}</p> : (
              <ul className="space-y-1.5">{d.history.map((h, i) => (
                <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <p className="text-slate-800">{h.summary || h.action}</p>
                  {h.changes.map((c, j) => <p key={j} className="text-slate-600">{c.label || c.field}: <s className="text-red-600">{String(c.from ?? '—')}</s> → <b className="text-emerald-700">{String(c.to ?? '—')}</b></p>)}
                  <p className="text-slate-500">{h.by}{h.role ? ` (${h.role})` : ''} · {formatDateTime(h.at)}</p>
                </li>
              ))}</ul>
            )}
          </div>
          <Link to={d.link} className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline" onClick={onClose}>{t('Open the original')} <ExternalLink size={13} /></Link>
        </div>
      )}
    </Modal>
  );
}

const LEVEL = { error: [XCircle, 'text-red-600'], warning: [AlertTriangle, 'text-amber-600'], info: [Info, 'text-slate-400'] };

function CheckRow({ c, onVerify }) {
  const [open, setOpen] = useState(false);
  const [Icon, cls] = c.ok ? [CheckCircle2, 'text-emerald-600'] : LEVEL[c.level];
  return (
    <li className="py-2.5">
      <button type="button" disabled={c.ok} onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left">
        <Icon size={17} className={cn('mt-0.5 shrink-0', cls)} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">{t(c.title)}{c.count ? ` (${c.count})` : ''}</span>
          {!c.ok && c.hint && <span className="block text-xs text-slate-500">{t(c.hint)}</span>}
        </span>
        {!c.ok && (open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />)}
      </button>
      {open && (
        <ul className="ml-8 mt-2 space-y-1 text-xs text-slate-700">
          {c.items.map((x, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-2 border-t border-slate-100 pt-1">
              {x.type && x.id ? <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => onVerify({ type: x.type, id: x.id })}>{x.no}</button> : <b>{x.no || x.name || x.what}</b>}
              {x.days !== undefined && <span>{t('dated {d}, entered {e} ({n} days later)', { d: dateLabel(x.date), e: dateLabel(x.enteredAt), n: x.days })}</span>}
              {x.entries && <span>{x.entries}</span>}
              {x.gstin && <span>{x.gstin}{x.stateCode ? ` · ${t('state')} ${x.stateCode}` : ''}</span>}
              {x.qty !== undefined && <span>{x.qty}</span>}
              {x.state && <span>{t('place of supply')} {x.state}</span>}
              {x.changes && <span className="text-slate-500">{x.changes} · {x.by} · {formatDateTime(x.at)}</span>}
              {x.amount !== undefined && <Amt v={x.amount} />}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AuditTab() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const [r, setR] = useState({ from: fyStart(), to: today() });
  const [verify, setVerify] = useState(null);
  const { data: found, loading: searching } = useQuery(['acc', 'search', dq], () => api.get('/accounts/search', { params: { q: dq } }).then((x) => x.data), { enabled: dq.trim().length >= 2, poll: false });
  const { data: checks, loading } = useQuery(['acc', 'audit-checks', r.from, r.to], () => api.get('/accounts/audit-checks', { params: r }).then((x) => x.data));
  const typeOf = (d) => (['Invoice', 'Purchase', 'Payment', 'ReturnNote', 'Expense', 'JournalVoucher'].includes(d.type) ? d.type : null);

  return (
    <div className="space-y-4">
      <Card>
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Search books')} placeholder={t('Search a party or a number — e.g. "Sharma Traders" or "INV/26-27/0025"')}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm focus-ring" />
        </div>
        {dq.trim().length >= 2 && (searching && !found ? <div className="flex justify-center py-6"><Spinner /></div> : (
          <div className="mt-3 space-y-3">
            {found?.parties?.map((p) => (
              <div key={p._id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={p.link} className="font-semibold text-slate-900 hover:underline">{p.name}</Link>
                  <span className="text-xs text-slate-500">{[p.type, p.phone, p.gstin].filter(Boolean).join(' · ')}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
                  {[['Sales', p.sales, `${p.bills} ${t('bills')}`], ['Purchases', p.purchases], ['Payments', p.paymentsTotal, `${p.payments}`], ['Returns', p.returns], ['GST', p.gst], ['Profit', p.profit], ['Outstanding', p.outstanding]].map(([l, v, sub]) => (
                    v === null ? null : <div key={l}><dt className="text-slate-500">{t(l)}</dt><dd className="font-semibold"><Amt v={v} /></dd>{sub && <dd className="text-slate-400">{sub}</dd>}</div>
                  ))}
                </dl>
              </div>
            ))}
            {found?.documents?.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {found.documents.map((d) => (
                  <li key={`${d.type}${d._id}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Badge tone="slate">{t(d.label)}</Badge>
                    <span className="min-w-0 flex-1 truncate">{d.no} · {dateLabel(d.date)}{d.cancelled ? ` · ${t('Cancelled')}` : ''}</span>
                    <Amt v={d.amount} />
                    {typeOf(d) && <button type="button" onClick={() => setVerify({ type: d.type, id: d._id })} className="text-xs font-medium text-brand-700 hover:underline">{t('Verify')}</button>}
                    <Link to={d.link} className="text-xs text-slate-500 hover:underline">{t('Open')}</Link>
                  </li>
                ))}
              </ul>
            )}
            {!found?.parties?.length && !found?.documents?.length && <p className="py-4 text-center text-sm text-slate-500">{t('Nothing found')}</p>}
          </div>
        ))}
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck size={17} className="text-brand-700" />{t('Error check')}</span>} subtitle={t('Backdated entries, duplicates, GST mistakes and edits — tap a number to verify it')} />
        <Toolbar><DateRange from={r.from} to={r.to} onChange={setR} /></Toolbar>
        {loading && !checks ? <div className="flex justify-center py-8"><Spinner /></div>
          : !checks ? <EmptyState title={t('Could not load checks')} />
            : <ul className="divide-y divide-slate-100">{checks.map((c) => <CheckRow key={c.key} c={c} onVerify={setVerify} />)}</ul>}
      </Card>
      <VerifyModal target={verify} onClose={() => setVerify(null)} />
    </div>
  );
}
