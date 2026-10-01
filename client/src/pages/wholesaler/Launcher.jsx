import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, X, Pencil, Check, LogOut, Video, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useOrderBadge } from '@/hooks/useOrderBadge';
import { useIntakeBadge } from '@/hooks/useIntakeBadge';
import { wholesalerNav } from '@/components/layout/navConfig';
import {
  visibleApps, QUICK_ACTIONS, DEFAULT_SHORTCUTS,
} from '@/components/layout/appsConfig';
import {
  Card, Button, Modal, ConfirmModal, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const Badge = ({ n }) => (n > 0 ? (
  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{n > 99 ? '99+' : n}</span>
) : null);

function ShortcutEditor({ open, onClose, chosen, actions }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const [picked, setPicked] = useState(chosen);
  const [saving, setSaving] = useState(false);
  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  async function save() {
    setSaving(true);
    try { await api.put('/auth/shortcuts', { shortcuts: picked }); await refresh?.(); toast.success(t('Shortcuts saved')); onClose(); } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Choose your shortcuts')} description={t('Pick as many as you like. They appear at the top of Home on all your devices.')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} onClick={save}>{t('Save')}</Button></>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((a) => {
          const on = picked.includes(a.key);
          const Icon = a.icon;
          return (
            <button key={a.key} type="button" onClick={() => toggle(a.key)} aria-pressed={on}
              className={cn('flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm focus-ring', on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
              <Icon size={18} className="shrink-0" /><span className="flex-1">{t(a.label)}</span>{on && <Check size={15} />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export default function Launcher() {
  const { user, business, can, logout } = useAuth();
  const toast = useToast();
  const newOrders = useOrderBadge();
  const intakeCount = useIntakeBadge();
  const badges = { newOrders, intakeCount };
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const [askLogout, setAskLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const apps = useMemo(() => visibleApps(can), [can]);
  const actions = useMemo(() => QUICK_ACTIONS.filter((a) => !a.perm || can(a.perm)), [can]);
  const chosen = (user?.shortcuts || DEFAULT_SHORTCUTS).filter((k) => actions.some((a) => a.key === k));
  const shortcuts = chosen.map((k) => actions.find((a) => a.key === k));

  const pages = useMemo(() => wholesalerNav.filter((n) => !n.perm || can(n.perm)), [can]);
  const needle = q.trim().toLowerCase();
  const found = needle ? pages.filter((n) => `${t(n.label)} ${n.label} ${n.desc ? t(n.desc) : ''} ${n.alt || ''}`.toLowerCase().includes(needle)) : [];
  const appBadge = (a) => a.menu.reduce((s, m) => s + (m.badgeKey ? badges[m.badgeKey] || 0 : 0), 0);

  async function doLogout() {
    setLoggingOut(true);
    try { await logout(); } catch (err) { toast.error(err.message); setLoggingOut(false); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{business?.name || t('Home')}</h1>
          <p className="text-sm text-slate-500">{t('Welcome, {n}', { n: user?.name?.split(' ')[0] || '' })}</p>
        </div>
      </div>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Shortcuts')}</p>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><Pencil size={12} />{t('Customise')}</button>
        </div>
        {shortcuts.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {shortcuts.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.key} to={a.to} className="relative flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 shadow-sm hover:border-brand-300 hover:bg-brand-50 focus-ring">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={17} /></span>
                  <span className="min-w-0 truncate">{t(a.label)}</span>
                  {a.badgeKey && <Badge n={badges[a.badgeKey]} />}
                </Link>
              );
            })}
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="w-full rounded-xl border border-dashed border-slate-300 py-4 text-sm text-slate-500 hover:bg-white">{t('Add shortcuts for the work you do most')}</button>
        )}
      </section>

      <div className="relative mb-5">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Search pages')} placeholder={t('Search any page — e.g. "expense" or "GST"')}
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus-ring" />
        {q && <button type="button" onClick={() => setQ('')} aria-label={t('Clear search')} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>}
      </div>

      {needle ? (
        <Card padding={false}>
          {!found.length ? <p className="py-8 text-center text-sm text-slate-500">{t('Nothing found. Try another word.')}</p> : (
            <ul className="divide-y divide-slate-100">
              {found.map((n) => {
                const Icon = n.icon;
                return (
                  <li key={n.to}>
                    <Link to={n.to} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <Icon size={18} className="shrink-0 text-slate-500" />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-900">{t(n.label)}</span>{n.desc && <span className="block truncate text-xs text-slate-500">{t(n.desc)}</span>}</span>
                      <ChevronRight size={15} className="text-slate-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <section>
          <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Apps')}</p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {apps.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.key} to={a.menu[0].to} className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center focus-ring">
                  <span className={cn('relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lg', a.tone)}>
                    <Icon size={28} />
                    <Badge n={appBadge(a)} />
                  </span>
                  <span className="text-sm font-medium text-slate-800">{t(a.label)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Card>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('rr:show-tour'))} className="flex w-full items-center gap-3 text-left focus-ring">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Video size={17} /></span>
            <span className="flex-1"><span className="block text-sm font-medium text-slate-900">{t('Watch the tour again')}</span><span className="block text-xs text-slate-500">{t('A short video for each page')}</span></span>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{user?.name}</p><p className="truncate text-xs text-slate-500">{user?.phone}</p></div>
            <Button variant="secondary" icon={LogOut} onClick={() => setAskLogout(true)}>{t('Logout')}</Button>
          </div>
        </Card>
      </div>

      {editing && <ShortcutEditor open onClose={() => setEditing(false)} chosen={chosen} actions={actions} />}
      <ConfirmModal open={askLogout} onClose={() => setAskLogout(false)} onConfirm={doLogout} loading={loggingOut}
        title={t('Logout karein?')} message={t('Dobara login karne ke liye phone number aur password lagega.')} confirmLabel={t('Haan, logout')} />
    </div>
  );
}
