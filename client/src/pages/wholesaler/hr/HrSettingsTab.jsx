import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import {
  Card, CardHeader, Button, Input, Switch, Spinner, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { WEEKDAYS } from './hrShared';

export default function HrSettingsTab() {
  const toast = useToast();
  const { can } = useAuth();
  const { data } = useQuery(['hr', 'settings'], () => api.get('/hr/settings').then((r) => r.data), { poll: false });
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!data) return <div className="flex justify-center py-10"><Spinner /></div>;
  const form = f || data;
  const editable = can('hr:edit');
  const set = (k, v) => setF({ ...form, [k]: v });
  const setLeave = (i, k, v) => set('leaveTypes', form.leaveTypes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function save() {
    setSaving(true);
    try {
      const res = await api.put('/hr/settings', {
        ...form,
        lateAfterMinutes: Number(form.lateAfterMinutes), halfDayHours: Number(form.halfDayHours), fullDayHours: Number(form.fullDayHours),
        leaveTypes: form.leaveTypes.map((l) => ({ ...l, name: l.name.trim(), yearlyQuota: Number(l.yearlyQuota) || 0 })),
      });
      toast.success(res.message); bust('hr'); setF(null);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('Working hours')} subtitle={t('Used to mark late arrival and half days automatically')} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label={t('Work starts at')} type="time" value={form.workStart} disabled={!editable} onChange={(e) => set('workStart', e.target.value)} />
          <Input label={t('Late after (minutes)')} inputMode="numeric" value={form.lateAfterMinutes} disabled={!editable} onChange={(e) => set('lateAfterMinutes', e.target.value)} />
          <Input label={t('Half day below (hours)')} inputMode="decimal" value={form.halfDayHours} disabled={!editable} onChange={(e) => set('halfDayHours', e.target.value)} />
          <Input label={t('Full day (hours)')} inputMode="decimal" value={form.fullDayHours} disabled={!editable} onChange={(e) => set('fullDayHours', e.target.value)} />
        </div>
        <p className="mb-1.5 mt-4 text-sm font-medium text-slate-700">{t('Weekly off')}</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w, i) => {
            const on = form.weeklyOff.includes(i);
            return (
              <button key={w} type="button" disabled={!editable} aria-pressed={on}
                onClick={() => set('weeklyOff', on ? form.weeklyOff.filter((d) => d !== i) : [...form.weeklyOff, i].sort())}
                className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium focus-ring', on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600')}>
                {t(w)}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('Check-in rules')} subtitle={t('Applies to the Employee App')} />
        <div className="space-y-3">
          <Switch id="req-photo" label={t('Require a selfie')} description={t('Employees must take a photo when checking in and out')} checked={form.requirePhoto} disabled={!editable} onChange={(v) => set('requirePhoto', v)} />
          <Switch id="req-loc" label={t('Require location')} description={t('Employees must allow GPS location when checking in and out')} checked={form.requireLocation} disabled={!editable} onChange={(v) => set('requireLocation', v)} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t('Leave types')} subtitle={t('Yearly quota per employee. 0 means no limit.')}
          action={editable && <Button size="sm" variant="secondary" icon={Plus} onClick={() => set('leaveTypes', [...form.leaveTypes, { name: '', paid: true, yearlyQuota: 0, active: true }])}>{t('Add')}</Button>} />
        <div className="space-y-2">
          {form.leaveTypes.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2 sm:flex-nowrap">
              <Input containerClassName="min-w-40 flex-1" label={i === 0 ? t('Name') : undefined} aria-label={t('Name')} value={l.name} disabled={!editable} onChange={(e) => setLeave(i, 'name', e.target.value)} />
              <Input containerClassName="w-24" label={i === 0 ? t('Days / year') : undefined} aria-label={t('Days / year')} inputMode="numeric" value={l.yearlyQuota} disabled={!editable} onChange={(e) => setLeave(i, 'yearlyQuota', e.target.value)} />
              <label className="flex h-10 items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={l.paid} disabled={!editable} onChange={(e) => setLeave(i, 'paid', e.target.checked)} />{t('Paid')}</label>
              <label className="flex h-10 items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={l.active} disabled={!editable} onChange={(e) => setLeave(i, 'active', e.target.checked)} />{t('Active')}</label>
              {editable && form.leaveTypes.length > 1 && (
                <button type="button" onClick={() => set('leaveTypes', form.leaveTypes.filter((_, j) => j !== i))} aria-label={t('Remove')} className="flex h-10 items-center rounded px-2 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {editable && f && (
        <div className="sticky bottom-20 mb-20 flex justify-end gap-2 lg:bottom-4 lg:mb-4">
          <Button variant="secondary" onClick={() => setF(null)}>{t('Discard')}</Button>
          <Button loading={saving} onClick={save}>{t('Save settings')}</Button>
        </div>
      )}
    </div>
  );
}
