import { Printer } from 'lucide-react';
import { formatMoney, formatDate } from '@/lib/format';
import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';
import { periodLabel } from './hrShared';

export function payslipLines(p) {
  const earn = [
    ['Basic', p.basic], ['Allowances', p.allowances], ['Commission', p.commission],
    ['Incentive', p.incentive], ['Bonus', p.bonus], ['Overtime', p.overtime],
  ].filter(([, v]) => v);
  const ded = [
    ['Leave / absence deduction', p.leaveDeduction], ['Advance recovered', p.advanceAdjusted], ['Other deductions', p.otherDeduction],
  ].filter(([, v]) => v);
  return { earn, ded };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function printPayslip(p) {
  const { earn, ded } = payslipLines(p);
  const row = ([k, v]) => `<tr><td>${esc(t(k))}</td><td class="r">${esc(formatMoney(v))}</td></tr>`;
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.payrollNo)}</title><style>
    body{font:14px/1.5 system-ui,sans-serif;color:#0f172a;margin:32px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:24px 0 8px;color:#475569}
    table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #e2e8f0}.r{text-align:right}.muted{color:#64748b}
    .net{margin-top:16px;padding:12px;background:#f1f5f9;border-radius:8px;display:flex;justify-content:space-between;font-weight:600;font-size:16px}
  </style></head><body>
    <h1>${esc(p.business?.name || '')}</h1><p class="muted">${esc(p.business?.address || '')}</p>
    <h2>${esc(t('Payslip'))} — ${esc(periodLabel(p.period))}</h2>
    <table><tr><td>${esc(t('Employee'))}</td><td class="r">${esc(p.employee?.name)} (${esc(p.employee?.code)})</td></tr>
    <tr><td>${esc(t('Payslip no.'))}</td><td class="r">${esc(p.payrollNo)}</td></tr>
    <tr><td>${esc(t('Paid days'))}</td><td class="r">${p.paidDays} / ${p.workingDays}</td></tr>
    ${p.paidAt ? `<tr><td>${esc(t('Paid on'))}</td><td class="r">${esc(formatDate(p.paidAt))} · ${esc(p.paymentMode)}</td></tr>` : ''}</table>
    <h2>${esc(t('Earnings'))}</h2><table>${earn.map(row).join('')}</table>
    ${ded.length ? `<h2>${esc(t('Deductions'))}</h2><table>${ded.map(row).join('')}</table>` : ''}
    <div class="net"><span>${esc(t('Net pay'))}</span><span>${esc(formatMoney(p.net))}</span></div>
    <p class="muted" style="margin-top:32px;font-size:12px">${esc(t('This is a system generated payslip.'))}</p>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export function PayslipBody({ p, onPrint }) {
  const { earn, ded } = payslipLines(p);
  const Line = ([k, v], neg) => (
    <div key={k} className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-600">{t(k)}</span>
      <span className={`tabular font-medium ${neg ? 'text-red-600' : 'text-slate-900'}`}>{neg ? '−' : ''}{formatMoney(v)}</span>
    </div>
  );
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">{t('Working days')}</p><p className="text-base font-semibold">{p.workingDays}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">{t('Paid days')}</p><p className="text-base font-semibold">{p.paidDays}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">{t('Unpaid')}</p><p className="text-base font-semibold">{p.unpaidLeaveDays + p.absentDays}</p></div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Earnings')}</p>
      <div className="divide-y divide-slate-100">{earn.map((l) => Line(l))}</div>
      {ded.length > 0 && <>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Deductions')}</p>
        <div className="divide-y divide-slate-100">{ded.map((l) => Line(l, true))}</div>
      </>}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5">
        <span className="font-semibold text-brand-800">{t('Net pay')}</span>
        <span className="tabular text-lg font-bold text-brand-800">{formatMoney(p.net)}</span>
      </div>
      {p.commissionSales > 0 && <p className="mt-2 text-xs text-slate-500">{t('Commission on sales of {a}', { a: formatMoney(p.commissionSales) })}</p>}
      {p.note && <p className="mt-2 text-xs text-slate-500">{p.note}</p>}
      {onPrint && <Button className="mt-4 w-full" variant="secondary" icon={Printer} onClick={onPrint}>{t('Print / Save PDF')}</Button>}
    </div>
  );
}
