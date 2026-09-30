import { useState } from 'react';
import { Plus, Trash2, Ban, FilePlus2 } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import {
  Card, CardHeader, Button, Input, Select, Modal, Badge, Chips, EmptyState, Spinner, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import {
  Amt, DateRange, PresetChips, Toolbar, today, fyStart, dateLabel,
} from './accShared';

const TEMPLATES = [
  ['Capital introduced', 'journal', [['bank', 'dr'], ['capital', 'cr']]],
  ['Owner drawings', 'journal', [['drawings', 'dr'], ['cash', 'cr']]],
  ['GST paid to government', 'journal', [['output_gst', 'dr'], ['bank', 'cr']]],
  ['Loan received', 'journal', [['bank', 'dr'], ['loans', 'cr']]],
  ['Cash deposited in bank', 'contra', [['bank', 'dr'], ['cash', 'cr']]],
  ['Cash withdrawn from bank', 'contra', [['cash', 'dr'], ['bank', 'cr']]],
];
const GROUPS = [['asset', 'Asset'], ['liability', 'Liability'], ['equity', 'Capital'], ['income', 'Income'], ['expense', 'Expense']];

function VoucherForm({ open, preset, onClose }) {
  const toast = useToast();
  const { data: accounts } = useQuery(['acc', 'options'], () => api.get('/accounts/accounts').then((x) => x.data), { poll: false, enabled: open });
  const blank = () => ({ kind: preset?.kind || 'journal', date: today(), narration: preset?.narration || '', lines: preset?.lines || [{ account: '', debit: '', credit: '' }, { account: '', debit: '', credit: '' }] });
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = f || blank();
  const setLine = (i, k, v) => setF({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, [k]: v, ...(k === 'debit' && v ? { credit: '' } : {}), ...(k === 'credit' && v ? { debit: '' } : {}) } : l)) });
  const dr = form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const opts = (accounts || []).filter((a) => form.kind !== 'contra' || ['cash', 'bank'].includes(a.key));

  async function save() {
    setSaving(true);
    try {
      const res = await api.post('/accounts/journals', { ...form, lines: form.lines.filter((l) => l.account).map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) });
      toast.success(res.message);
      bust('acc');
      setF(null);
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={() => { setF(null); onClose(); }} size="lg" title={form.kind === 'contra' ? t('Contra voucher') : t('Journal voucher')}
      description={form.kind === 'contra' ? t('Move money between cash and bank') : t('For capital, drawings, loans, assets, GST payments and other adjustments')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} disabled={!dr || Math.abs(dr - cr) > 0.001} onClick={save}>{t('Save voucher')}</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t('Voucher type')} value={form.kind} onChange={(e) => setF({ ...form, kind: e.target.value })} options={[{ value: 'journal', label: t('Journal') }, { value: 'contra', label: t('Contra (cash ↔ bank)') }]} />
          <Input label={t('Date')} type="date" max={today()} value={form.date} onChange={(e) => setF({ ...form, date: e.target.value })} />
        </div>
        <div className="space-y-2">
          {form.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_6.5rem_6.5rem_auto] items-end gap-2">
              <Select aria-label={t('Account')} label={i === 0 ? t('Account') : undefined} value={l.account} onChange={(e) => setLine(i, 'account', e.target.value)}
                options={[{ value: '', label: t('Choose account') }, ...opts.map((a) => ({ value: a.key, label: t(a.name) }))]} />
              <Input aria-label={t('Debit')} label={i === 0 ? t('Debit') : undefined} inputMode="decimal" value={l.debit} onChange={(e) => setLine(i, 'debit', e.target.value)} />
              <Input aria-label={t('Credit')} label={i === 0 ? t('Credit') : undefined} inputMode="decimal" value={l.credit} onChange={(e) => setLine(i, 'credit', e.target.value)} />
              <button type="button" disabled={form.lines.length <= 2} onClick={() => setF({ ...form, lines: form.lines.filter((_, j) => j !== i) })} aria-label={t('Remove')} className="flex h-10 items-center px-1 text-slate-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setF({ ...form, lines: [...form.lines, { account: '', debit: '', credit: '' }] })}>{t('Add line')}</Button>
            <p className={`text-xs ${Math.abs(dr - cr) > 0.001 ? 'text-red-600' : 'text-emerald-700'}`}>{t('Debit')} <Amt v={dr} /> · {t('Credit')} <Amt v={cr} /></p>
          </div>
        </div>
        <Input label={t('Narration')} value={form.narration} onChange={(e) => setF({ ...form, narration: e.target.value })} placeholder={t('e.g. Capital brought in by owner')} />
      </div>
    </Modal>
  );
}

function Heads() {
  const toast = useToast();
  const { can } = useAuth();
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data } = useQuery(['acc', 'heads'], () => api.get('/accounts/heads').then((x) => x.data), { poll: false });
  async function save() {
    setSaving(true);
    try {
      const res = edit._id ? await api.put(`/accounts/heads/${edit._id}`, { name: edit.name, group: edit.group, active: edit.active }) : await api.post('/accounts/heads', { name: edit.name, group: edit.group });
      toast.success(res.message); bust('acc'); setEdit(null);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }
  return (
    <Card>
      <CardHeader title={t('My accounts')} subtitle={t('Your own ledger accounts, like a bank loan, furniture or a rent deposit')}
        action={can('khata:approve') && <Button size="sm" icon={Plus} onClick={() => setEdit({ name: '', group: 'asset', active: true })}>{t('Add')}</Button>} />
      {!data?.length ? <p className="py-4 text-sm text-slate-400">{t('No custom accounts yet')}</p> : (
        <ul className="divide-y divide-slate-100">
          {data.map((h) => (
            <li key={h._id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-slate-900">{h.name} {!h.active && <Badge tone="slate">{t('Inactive')}</Badge>}</span>
              <span className="flex items-center gap-2"><Badge tone="blue">{t(GROUPS.find(([g]) => g === h.group)?.[1])}</Badge>
                {can('khata:approve') && <button type="button" onClick={() => setEdit(h)} className="text-xs font-medium text-brand-700 hover:underline">{t('Edit')}</button>}</span>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? t('Edit account') : t('New account')}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('Cancel')}</Button><Button loading={saving} disabled={(edit?.name || '').trim().length < 2} onClick={save}>{t('Save')}</Button></>}>
        {edit && (
          <div className="space-y-3">
            <Input label={t('Account name')} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Select label={t('Group')} value={edit.group} onChange={(e) => setEdit({ ...edit, group: e.target.value })} options={GROUPS.map(([v, l]) => ({ value: v, label: t(l) }))} />
            {edit._id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />{t('Active')}</label>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

export default function JournalTab() {
  const toast = useToast();
  const { can } = useAuth();
  const [view, setView] = useState('vouchers');
  const [r, setR] = useState({ from: fyStart(), to: today() });
  const [form, setForm] = useState(null);
  const { data, loading } = useQuery(['acc', 'journals', r.from, r.to], () => api.get('/accounts/journals', { params: r }).then((x) => x.data));
  const canPost = can('khata:approve');

  async function cancel(j) {
    const reason = window.prompt(t('Why are you cancelling {n}?', { n: j.voucherNo }));
    if (!reason || reason.trim().length < 3) return;
    try { const res = await api.post(`/accounts/journals/${j._id}/cancel`, { reason }); toast.success(res.message); bust('acc'); } catch (err) { toast.error(err.message); }
  }

  return (
    <div className="space-y-4">
      <Chips value={view} onChange={setView} options={[{ value: 'vouchers', label: 'Vouchers' }, { value: 'heads', label: 'My accounts' }]} />
      {view === 'heads' ? <Heads /> : (
        <>
          {canPost && (
            <Card>
              <CardHeader title={t('Quick entry')} subtitle={t('Pick a common entry or start a blank voucher')} />
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map(([label, kind, lines]) => (
                  <Button key={label} size="sm" variant="secondary" onClick={() => setForm({ kind, narration: t(label), lines: lines.map(([account]) => ({ account, debit: '', credit: '' })) })}>{t(label)}</Button>
                ))}
                <Button size="sm" icon={FilePlus2} onClick={() => setForm({})}>{t('Blank voucher')}</Button>
              </div>
            </Card>
          )}
          <Card>
            <Toolbar><DateRange from={r.from} to={r.to} onChange={setR} /><PresetChips onPick={setR} /></Toolbar>
            {loading && !data ? <div className="flex justify-center py-10"><Spinner /></div> : !data?.length ? <EmptyState title={t('No vouchers yet')} message={t('Sales, purchases, payments and expenses are posted automatically. Use vouchers only for entries like capital, loans or cash deposits.')} /> : (
              <ul className="divide-y divide-slate-100">
                {data.map((j) => (
                  <li key={j._id} className={`py-3 ${j.cancelled ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{j.voucherNo} · {j.narration} {j.cancelled && <Badge tone="red">{t('Cancelled')}</Badge>}</p>
                        <p className="text-xs text-slate-500">{dateLabel(j.date)} · {j.lines.map((l) => `${t(l.name)} ${l.debit ? t('Dr') : t('Cr')} ${l.debit || l.credit}`).join(' · ')}</p>
                        {j.cancelled && j.cancelReason && <p className="text-xs text-red-600">{j.cancelReason}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Amt v={j.amount} strong />
                        {canPost && !j.cancelled && <button type="button" onClick={() => cancel(j)} aria-label={t('Cancel voucher')} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Ban size={15} /></button>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      <VoucherForm key={JSON.stringify(form)} open={Boolean(form)} preset={form} onClose={() => setForm(null)} />
    </div>
  );
}
