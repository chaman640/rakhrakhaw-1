import { useState } from 'react';
import { Plus, Landmark, Star, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import {
  Card, Button, Input, Modal, Switch, Badge, Spinner, EmptyState, ConfirmModal, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { Amt, today } from './accShared';

const BLANK = { name: '', bankName: '', accountNo: '', ifsc: '', openingBalance: '', openingDate: '', isDefault: false, active: true };

export default function BanksTab({ openLedger }) {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can('khata:approve');
  const { data, loading } = useQuery(['acc', 'banks'], () => api.get('/accounts/banks').then((x) => x.data));
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  function open(b) {
    setF(b ? { ...BLANK, ...b, openingBalance: b.openingBalance || '', openingDate: b.openingDate ? String(b.openingDate).slice(0, 10) : '' } : { ...BLANK, openingDate: today() });
    setEdit(b || {});
  }
  async function save() {
    setSaving(true);
    try {
      const body = { name: f.name, bankName: f.bankName, accountNo: f.accountNo, ifsc: f.ifsc, openingBalance: Number(f.openingBalance || 0), openingDate: f.openingDate ? new Date(f.openingDate).toISOString() : null, isDefault: f.isDefault, active: f.active };
      const res = edit._id ? await api.put(`/accounts/banks/${edit._id}`, body) : await api.post('/accounts/banks', body);
      toast.success(res.message);
      bust('acc', 'bank-options');
      setEdit(null);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function remove() {
    try { await api.delete(`/accounts/banks/${del._id}`); toast.success(t('Deleted')); bust('acc', 'bank-options'); } catch (e) { toast.error(e.message); } finally { setDel(null); }
  }

  if (loading && !data) return <div className="flex justify-center py-12"><Spinner /></div>;
  const rows = data?.rows || [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{t('UPI, cheque and transfer payments go to the chosen account, or to the default one.')}</p>
        {canEdit && <Button icon={Plus} onClick={() => open(null)}>{t('Add bank account')}</Button>}
      </div>
      {!rows.length ? (
        <EmptyState icon={Landmark} title={t('No bank accounts yet')} message={t('Add your current account, savings account or UPI-linked account to see a separate balance for each.')}
          action={canEdit && <Button onClick={() => open(null)}>{t('Add bank account')}</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <Card key={b._id} className={b.active ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => openLedger(`bank:${b._id}`)} className="min-w-0 text-left">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900">{b.name}{b.isDefault && <Star size={13} className="fill-amber-400 text-amber-400" aria-label={t('Default')} />}</p>
                  <p className="truncate text-xs text-slate-500">{[b.bankName, b.accountNo && `A/c ••${b.accountNo.slice(-4)}`, b.ifsc].filter(Boolean).join(' · ')}</p>
                </button>
                {canEdit && (
                  <div className="flex shrink-0">
                    <Button size="sm" variant="ghost" icon={Pencil} aria-label={t('Edit')} onClick={() => open(b)} />
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('Delete')} onClick={() => setDel(b)} />
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">{t('Balance')}</p>
              <p className="text-xl font-semibold"><Amt v={b.balance} /></p>
              {!b.active && <Badge tone="slate" className="mt-1">{t('Closed')}</Badge>}
            </Card>
          ))}
        </div>
      )}
      {data?.unassigned ? <p className="text-xs text-slate-500">{t('Bank entries made by journal before accounts were added')}: <Amt v={data.unassigned} /> <button type="button" className="text-brand-700 hover:underline" onClick={() => openLedger('bank')}>{t('View')}</button></p> : null}

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? t('Edit bank account') : t('Add bank account')}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('Cancel')}</Button><Button loading={saving} disabled={f.name.trim().length < 2} onClick={save}>{t('Save')}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('Account name')} required value={f.name} onChange={set('name')} placeholder={t('e.g. HDFC Current')} />
          <Input label={t('Bank')} value={f.bankName} onChange={set('bankName')} />
          <Input label={t('Account number')} value={f.accountNo} onChange={set('accountNo')} inputMode="numeric" />
          <Input label="IFSC" value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })} maxLength={11} />
          <Input label={t('Opening balance')} type="number" prefix="₹" value={f.openingBalance} onChange={set('openingBalance')} />
          <Input label={t('As on')} type="date" value={f.openingDate} onChange={set('openingDate')} />
        </div>
        <div className="mt-3 space-y-2">
          <Switch id="bank-default" checked={f.isDefault} onChange={(v) => setF({ ...f, isDefault: v })} label={t('Default account')} description={t('Non-cash payments without a chosen account go here')} />
          {edit?._id && <Switch id="bank-active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} label={t('Account in use')} description={t('Turn off for a closed account — its history stays')} />}
        </div>
      </Modal>
      <ConfirmModal open={Boolean(del)} onClose={() => setDel(null)} onConfirm={remove} title={t('Delete this account?')} message={del?.name} confirmLabel={t('Delete')} />
    </div>
  );
}
