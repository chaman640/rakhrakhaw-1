import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, MapPinned } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useFeature } from '@/hooks/useBilling';
import {
  Card, CardHeader, Button, Input, Select, Switch, Spinner, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { useAssignable, SOURCES } from './CrmParts';

const AUTO = [
  ['reorder', 'Re-order reminders', 'Call task when a customer’s usual re-order time comes'],
  ['inactivity', 'Inactive customer alerts', 'Call task when a customer is later than usual'],
  ['quotation', 'Pending quotation follow-up', 'Task when a sent quotation has no order after some days'],
  ['leadEscalation', 'Manager alert for untouched leads', 'Tell the owner when nobody contacted a lead'],
];

export default function CrmSettingsTab() {
  const toast = useToast();
  const smart = useFeature('crm_smart');
  const pro = useFeature('crm_pro');
  const { staff } = useAssignable();
  const { data, loading } = useQuery(['crm', 'settings'], () => api.get('/crm/settings').then((r) => r.data), { poll: false });
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState('');
  useEffect(() => { if (data && !f) setF(data); }, [data, f]);
  if (loading || !f) return <div className="flex justify-center py-12"><Spinner /></div>;

  const num = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const staffOpts = staff.map((s) => ({ value: s._id, label: s.name }));
  async function save(part, body) {
    setSaving(part);
    try {
      const res = await api.put('/crm/settings', body);
      setF(res.data);
      bust('crm');
      toast.success(res.message);
    } catch (e) { toast.error(e.message); } finally { setSaving(''); }
  }
  async function runNow() {
    setSaving('run');
    try {
      const res = await api.post('/crm/auto-tasks');
      toast.success(res.data.skipped ? t('Automation is off') : t('{n} tasks created, {e} leads escalated', { n: res.data.created || 0, e: res.data.escalated || 0 }));
      bust('crm');
    } catch (e) { toast.error(e.message); } finally { setSaving(''); }
  }
  async function applyTerr() {
    setSaving('apply');
    try {
      const res = await api.post('/crm/territories/apply', { overwrite: false });
      toast.success(t('{n} customers assigned by area', { n: res.data.updated }));
      bust('crm', 'parties');
    } catch (e) { toast.error(e.message); } finally { setSaving(''); }
  }
  const la = f.leadAssign || { mode: 'none', userIds: [], rules: [] };
  const setLa = (patch) => setF({ ...f, leadAssign: { ...la, ...patch } });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('Customer groups')} subtitle={t('Used for VIP, high value, new and inactive tags')} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label={t('VIP: yearly purchase')} type="number" prefix="₹" value={f.vipAmount} onChange={num('vipAmount')} />
          <Input label={t('High value: 6-month purchase')} type="number" prefix="₹" value={f.highValueAmount} onChange={num('highValueAmount')} />
          <Input label={t('Inactive after (days)')} type="number" value={f.inactiveDays} onChange={num('inactiveDays')} />
          <Input label={t('New for (days)')} type="number" value={f.newDays} onChange={num('newDays')} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button loading={saving === 'groups'} onClick={() => save('groups', {
            vipAmount: Number(f.vipAmount), highValueAmount: Number(f.highValueAmount), inactiveDays: Number(f.inactiveDays), newDays: Number(f.newDays),
          })}>{t('Save')}</Button>
        </div>
      </Card>

      {smart.allowed && (<Card>
        <CardHeader title={t('Automatic follow-ups')} subtitle={smart.allowed ? t('Tasks go to the customer’s salesman (or area owner), otherwise to you') : t('Available in the ₹500 plan and above')}
          action={smart.allowed && <Button size="sm" variant="secondary" icon={Play} loading={saving === 'run'} onClick={runNow}>{t('Run now')}</Button>} />
        <fieldset disabled={!smart.allowed} className="space-y-3 disabled:opacity-60">
          <Switch id="auto-on" checked={f.automation.enabled} onChange={(v) => setF({ ...f, automation: { ...f.automation, enabled: v } })} label={t('Automation on')} />
          {AUTO.map(([k, l, d]) => (
            <div key={k} className="border-t border-slate-100 pt-3">
              <Switch id={`auto-${k}`} checked={f.automation[k]} onChange={(v) => setF({ ...f, automation: { ...f.automation, [k]: v } })} label={t(l)} description={t(d)} />
            </div>
          ))}
          <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
            <Input label={t('Quotation follow-up after (days)')} type="number" value={f.quotationFollowUpDays} onChange={num('quotationFollowUpDays')} />
            <Input label={t('Alert if lead untouched for (days)')} type="number" value={f.leadNoResponseDays} onChange={num('leadNoResponseDays')} />
            <Select label={t('Complaints go to')} value={f.complaintAssigneeUserId || ''} onChange={(e) => setF({ ...f, complaintAssigneeUserId: e.target.value || null })}
              options={[{ value: '', label: t('Customer’s salesman') }, ...staffOpts]} />
          </div>
          <div className="flex justify-end">
            <Button loading={saving === 'auto'} onClick={() => save('auto', {
              automation: f.automation, quotationFollowUpDays: Number(f.quotationFollowUpDays), leadNoResponseDays: Number(f.leadNoResponseDays), complaintAssigneeUserId: f.complaintAssigneeUserId || null,
            })}>{t('Save')}</Button>
          </div>
        </fieldset>
      </Card>)}

      {smart.allowed && (<Card>
        <CardHeader title={t('New lead assignment')} subtitle={t('Who gets a new lead when you don’t pick anyone')} />
        <fieldset disabled={!smart.allowed} className="space-y-3 disabled:opacity-60">
          <Select label={t('Method')} value={la.mode} onChange={(e) => setLa({ mode: e.target.value })} options={[
            { value: 'none', label: t('Whoever creates it') },
            { value: 'round_robin', label: t('Rotate between selected staff') },
            ...(pro.allowed ? [{ value: 'rules', label: t('Rules by city / source / value') }] : []),
          ]} />
          {la.mode === 'round_robin' && (
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => {
                const on = la.userIds.map(String).includes(String(s._id));
                return (
                  <button key={s._id} type="button" aria-pressed={on} onClick={() => setLa({ userIds: on ? la.userIds.filter((u) => String(u) !== String(s._id)) : [...la.userIds, s._id] })}
                    className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600'}`}>{s.name}</button>
                );
              })}
            </div>
          )}
          {la.mode === 'rules' && (
            <div className="space-y-2">
              {la.rules.map((r, i) => (
                <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <Input label={t('City')} value={r.city} onChange={(e) => setLa({ rules: la.rules.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)) })} placeholder={t('Any')} />
                  <Select label={t('Source')} value={r.source} onChange={(e) => setLa({ rules: la.rules.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) })} options={[{ value: '', label: t('Any') }, ...SOURCES.map(([v, l]) => ({ value: v, label: t(l) }))]} />
                  <Input label={t('Value at least')} type="number" prefix="₹" value={r.minValue} onChange={(e) => setLa({ rules: la.rules.map((x, j) => (j === i ? { ...x, minValue: e.target.value } : x)) })} />
                  <Select label={t('Give to')} value={r.userId} onChange={(e) => setLa({ rules: la.rules.map((x, j) => (j === i ? { ...x, userId: e.target.value } : x)) })} options={staffOpts} />
                  <Button variant="ghost" icon={Trash2} aria-label={t('Remove')} onClick={() => setLa({ rules: la.rules.filter((_, j) => j !== i) })} />
                </div>
              ))}
              <Button size="sm" variant="secondary" icon={Plus} disabled={!staff.length} onClick={() => setLa({ rules: [...la.rules, { city: '', source: '', minValue: 0, userId: staff[0]?._id }] })}>{t('Add rule')}</Button>
              <p className="text-xs text-slate-500">{t('The first matching rule wins. If none match, leads rotate between staff selected above (if any).')}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button loading={saving === 'lead'} onClick={() => save('lead', {
              leadAssign: { mode: la.mode, userIds: la.userIds, rules: la.mode === 'rules' ? la.rules.map((r) => ({ ...r, minValue: Number(r.minValue || 0) })) : [] },
            })}>{t('Save')}</Button>
          </div>
        </fieldset>
      </Card>)}

      {pro.allowed && (<Card>
        <CardHeader title={<span className="flex items-center gap-2"><MapPinned size={16} className="text-brand-700" />{t('Territories')}</span>}
          subtitle={pro.allowed ? t('Group cities into areas and give each area to a salesman') : t('Available in the ₹2000 plan')} />
        <fieldset disabled={!pro.allowed} className="space-y-2 disabled:opacity-60">
          {f.territories.map((tr, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
              <Input label={t('Area name')} value={tr.name} onChange={(e) => setF({ ...f, territories: f.territories.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder={t('e.g. Delhi NCR')} />
              <Input label={t('Cities (comma separated)')} value={Array.isArray(tr.cities) ? tr.cities.join(', ') : tr.cities}
                onChange={(e) => setF({ ...f, territories: f.territories.map((x, j) => (j === i ? { ...x, cities: e.target.value } : x)) })} placeholder={t('e.g. Noida, Ghaziabad')} />
              <Select label={t('Salesman')} value={tr.userId || ''} onChange={(e) => setF({ ...f, territories: f.territories.map((x, j) => (j === i ? { ...x, userId: e.target.value || null } : x)) })} options={[{ value: '', label: t('Nobody') }, ...staffOpts]} />
              <Button variant="ghost" icon={Trash2} aria-label={t('Remove')} onClick={() => setF({ ...f, territories: f.territories.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-2">
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setF({ ...f, territories: [...f.territories, { name: '', cities: '', userId: null }] })}>{t('Add area')}</Button>
            <div className="flex gap-2">
              <Button variant="secondary" loading={saving === 'apply'} onClick={applyTerr}>{t('Assign unassigned customers')}</Button>
              <Button loading={saving === 'terr'} onClick={() => save('terr', {
                territories: f.territories.filter((x) => x.name.trim()).map((x) => ({
                  name: x.name.trim(), userId: x.userId || null,
                  cities: (Array.isArray(x.cities) ? x.cities : String(x.cities).split(',')).map((c) => c.trim()).filter(Boolean),
                })),
              })}>{t('Save')}</Button>
            </div>
          </div>
        </fieldset>
      </Card>)}
    </div>
  );
}
