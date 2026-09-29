import { useState } from 'react';
import { Wand2, CheckCheck, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatDate } from '@/lib/format';
import {
  Card, Button, Badge, Input, Select, Modal, Table, Chips, Textarea, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import {
  MonthPicker, thisPeriod, periodLabel, Stat, PAY_TONE, Cap, useHrMeta,
} from './hrShared';
import { PayslipBody, printPayslip } from './Payslip';

const MODES = ['BANK', 'UPI', 'CASH', 'CHEQUE'].map((m) => ({ value: m, label: m }));

function PayrollModal({ row, onClose }) {
  const toast = useToast();
  const { can } = useAuth();
  const [edit, setEdit] = useState(null);
  const [mode, setMode] = useState('BANK');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  if (!row) return null;
  const draft = row.status === 'draft';
  const e = edit || { incentive: row.incentive, bonus: row.bonus, overtime: row.overtime, otherDeduction: row.otherDeduction, leaveDeduction: row.leaveDeduction, note: row.note };
  const set = (k) => (ev) => setEdit({ ...e, [k]: ev.target.value });

  async function run(key, fn) {
    setBusy(key);
    try { const res = await fn(); toast.success(res.message); bust('hr', 'expenses', 'dashboard'); setEdit(null); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  }
  const saveEdit = () => run('save', () => api.put(`/hr/payroll/${row._id}`, Object.fromEntries(Object.entries(e).map(([k, v]) => [k, k === 'note' ? v : Number(v) || 0]))));
  const print = async () => { try { printPayslip((await api.get(`/hr/payroll/${row._id}/payslip`)).data); } catch (err) { toast.error(err.message); } };

  return (
    <Modal open onClose={() => { setEdit(null); onClose(); }} title={`${row.name} · ${periodLabel(row.period)}`} description={`${row.payrollNo} · ${Cap(row.status)}`}
      footer={(
        <>
          {row.status !== 'cancelled' && can('payroll:approve') && !edit && <Button variant="ghost" onClick={() => setEdit({ cancel: true, ...e })}>{t('Cancel payroll')}</Button>}
          {draft && edit && !edit.cancel && <Button loading={busy === 'save'} onClick={saveEdit}>{t('Save')}</Button>}
          {draft && !edit && can('payroll:create') && <Button variant="secondary" onClick={() => setEdit(e)}>{t('Adjust')}</Button>}
          {draft && !edit && can('payroll:approve') && <Button loading={busy === 'approve'} onClick={() => run('approve', () => api.post('/hr/payroll/approve', { ids: [row._id] }))}>{t('Approve')}</Button>}
          {row.status === 'approved' && !edit && can('payroll:approve') && <Button loading={busy === 'pay'} onClick={() => run('pay', () => api.post(`/hr/payroll/${row._id}/pay`, { mode }))}>{t('Mark as paid')}</Button>}
        </>
      )}>
      {edit?.cancel ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{row.status === 'paid' ? t('The salary expense for this payroll will be removed and any recovered advance will be released.') : t('Recovered advances will be released.')}</p>
          <Textarea label={t('Reason')} rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEdit(null)}>{t('Back')}</Button>
            <Button variant="danger" loading={busy === 'cancel'} disabled={reason.trim().length < 3} onClick={() => run('cancel', () => api.post(`/hr/payroll/${row._id}/cancel`, { reason }))}>{t('Cancel payroll')}</Button>
          </div>
        </div>
      ) : edit ? (
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('Incentive')} prefix="₹" inputMode="decimal" value={e.incentive} onChange={set('incentive')} />
          <Input label={t('Bonus')} prefix="₹" inputMode="decimal" value={e.bonus} onChange={set('bonus')} />
          <Input label={t('Overtime')} prefix="₹" inputMode="decimal" value={e.overtime} onChange={set('overtime')} />
          <Input label={t('Leave / absence deduction')} prefix="₹" inputMode="decimal" value={e.leaveDeduction} onChange={set('leaveDeduction')} />
          <Input label={t('Other deductions')} prefix="₹" inputMode="decimal" value={e.otherDeduction} onChange={set('otherDeduction')} />
          <div className="col-span-2"><Textarea label={t('Note')} rows={2} value={e.note} onChange={set('note')} /></div>
        </div>
      ) : (
        <>
          <PayslipBody p={row} onPrint={row.status !== 'cancelled' ? print : null} />
          {row.status === 'approved' && can('payroll:approve') && (
            <div className="mt-4"><Select label={t('Paid via')} value={mode} onChange={(ev) => setMode(ev.target.value)} options={MODES} /></div>
          )}
          {row.status === 'paid' && <p className="mt-3 text-xs text-slate-500">{t('Paid on {d} via {m}. Salary expense recorded in Expenses.', { d: formatDate(row.paidAt), m: row.paymentMode })}</p>}
          {row.status === 'cancelled' && <p className="mt-3 text-xs text-red-600">{row.cancelReason}</p>}
        </>
      )}
    </Modal>
  );
}

function Advances() {
  const toast = useToast();
  const { can } = useAuth();
  const { data: meta } = useHrMeta();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ userId: '', amount: '', mode: 'CASH', note: '' });
  const [saving, setSaving] = useState(false);
  const { data, loading } = useQuery(['hr', 'advances'], () => api.get('/hr/payroll/advances').then((r) => r.data));

  async function save() {
    setSaving(true);
    try {
      const res = await api.post('/hr/payroll/advances', { ...f, amount: Number(f.amount) });
      toast.success(res.message); bust('hr'); setAdding(false); setF({ userId: '', amount: '', mode: 'CASH', note: '' });
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }
  async function remove(a) {
    if (!window.confirm(t('Remove this advance?'))) return;
    try { await api.delete(`/hr/payroll/advances/${a._id}`); bust('hr'); } catch (err) { toast.error(err.message); }
  }

  const columns = [
    { key: 'name', header: t('Employee') },
    { key: 'date', header: t('Date'), render: (a) => formatDate(a.date) },
    { key: 'amount', header: t('Amount'), align: 'right', render: (a) => formatMoney(a.amount) },
    { key: 'status', header: t('Status'), render: (a) => <Badge tone={a.recovered ? 'green' : 'amber'}>{a.recovered ? t('Recovered') : t('Pending recovery')}</Badge> },
    ...(can('payroll:create') ? [{ key: 'actions', header: '', render: (a) => !a.recovered && <button type="button" onClick={() => remove(a)} aria-label={t('Remove')} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button> }] : []),
  ];
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{t('Advances are recovered automatically in the next payroll.')}</p>
        {can('payroll:create') && <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>{t('Give advance')}</Button>}
      </div>
      <Table columns={columns} rows={data || []} loading={loading && !data} emptyTitle={t('No salary advances')} />
      <Modal open={adding} onClose={() => setAdding(false)} title={t('Salary advance')}
        footer={<><Button variant="secondary" onClick={() => setAdding(false)}>{t('Cancel')}</Button><Button loading={saving} disabled={!f.userId || !(Number(f.amount) > 0)} onClick={save}>{t('Save')}</Button></>}>
        <div className="space-y-3">
          <Select label={t('Employee')} value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })}
            options={[{ value: '', label: t('Choose employee') }, ...(meta?.staff || []).map((s) => ({ value: s._id, label: s.name }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('Amount')} prefix="₹" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            <Select label={t('Paid via')} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={MODES} />
          </div>
          <Input label={t('Note (optional)')} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}

function Run() {
  const toast = useToast();
  const { can } = useAuth();
  const [period, setPeriod] = useState(thisPeriod());
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');
  const { data, loading } = useQuery(['hr', 'payroll', period], () => api.get('/hr/payroll', { params: { period } }).then((r) => r.data));
  const rows = data?.rows || [];
  const tot = data?.totals || {};
  const drafts = rows.filter((r) => r.status === 'draft');

  async function run(key, fn) {
    setBusy(key);
    try { const res = await fn(); toast.success(res.message); bust('hr'); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  }

  const columns = [
    { key: 'name', header: t('Employee'), render: (r) => <span><span className="block font-medium text-slate-900">{r.name}</span><span className="block text-xs text-slate-500">{r.code} · {r.payrollNo}</span></span> },
    { key: 'days', header: t('Paid days'), align: 'right', render: (r) => `${r.paidDays}/${r.workingDays}` },
    { key: 'gross', header: t('Gross'), align: 'right', render: (r) => formatMoney(r.gross) },
    { key: 'ded', header: t('Deductions'), align: 'right', render: (r) => formatMoney(r.leaveDeduction + r.otherDeduction + r.advanceAdjusted) },
    { key: 'net', header: t('Net pay'), align: 'right', render: (r) => <span className="font-semibold">{formatMoney(r.net)}</span> },
    { key: 'status', header: t('Status'), render: (r) => <Badge tone={PAY_TONE[r.status]}>{Cap(r.status)}</Badge> },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthPicker value={period} onChange={setPeriod} />
        <div className="flex-1" />
        {can('payroll:create') && <Button variant="secondary" icon={Wand2} loading={busy === 'gen'} onClick={() => run('gen', () => api.post('/hr/payroll/generate', { period }))}>{t('Generate payroll')}</Button>}
        {can('payroll:approve') && drafts.length > 0 && <Button icon={CheckCheck} loading={busy === 'approve'} onClick={() => run('approve', () => api.post('/hr/payroll/approve', { ids: drafts.map((d) => d._id) }))}>{t('Approve all drafts ({n})', { n: drafts.length })}</Button>}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('Employees')} value={tot.count ?? 0} />
        <Stat label={t('Total net pay')} value={formatMoney(tot.net || 0)} tone="brand" />
        <Stat label={t('Pending approval')} value={tot.draft || 0} tone="amber" />
        <Stat label={t('Paid')} value={formatMoney(tot.paidAmount || 0)} tone="green" />
      </div>
      <Table columns={columns} rows={rows} loading={loading && !data} onRowClick={setOpen}
        emptyTitle={t('No payroll for {m}', { m: periodLabel(period) })}
        emptyMessage={t('Set salary in each employee profile, then click Generate payroll. Attendance, unpaid leave, commission and advances are calculated automatically.')} />
      <PayrollModal row={open} onClose={() => setOpen(null)} />
    </>
  );
}

export default function PayrollTab() {
  const [view, setView] = useState('run');
  return (
    <Card>
      <Chips className="mb-4" value={view} onChange={setView} options={[{ value: 'run', label: 'Monthly payroll' }, { value: 'advances', label: 'Advances' }]} />
      {view === 'run' ? <Run /> : <Advances />}
    </Card>
  );
}
