import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Printer, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Card, CardHeader, Button, Input, useToast } from '@/components/ui';
import LedgerTable, { BalanceLine } from '../khata/LedgerTable';
import PaymentFormModal from '../payments/PaymentFormModal';
import { t } from '@/lib/i18n';

/**
 * Ek party ka poora khata — Retailer/Supplier detail page ke "Khata" tab me.
 * Yahin se seedha payment bhi entry ho jati hai.
 */
export default function PartyKhataTab({ party, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const isSupplier = party.type === 'supplier';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/khata/${party._id}`, {
        params: { from: from || undefined, to: to || undefined },
      });
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party._id, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{isSupplier ? 'Inko dena hai' : 'Inse lena hai'}</p>
            <p className="mt-1 text-2xl">
              <BalanceLine balance={data?.party?.balance ?? party.balance} type={party.type} />
            </p>
            {party.creditLimit > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {t('Credit limit {amt}', { amt: formatMoney(party.creditLimit) })}
                {party.balance > party.creditLimit && (
                  <span className="ml-1 font-medium text-red-600">{t('— limit paar ho gayi')}</span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button icon={Wallet} onClick={() => setPayOpen(true)}>
              {isSupplier ? 'Paisa diya' : 'Paisa aaya'}
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>{t('Print')}</Button>
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <div className="w-36">
            <Input label={t('Kab se')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-36">
            <Input label={t('Kab tak')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <Button variant="ghost" size="sm" icon={RotateCcw}
              onClick={() => { setFrom(''); setTo(''); }}>
              {t('Hatayein')}
            </Button>
          )}
        </div>

        <div className="invoice-sheet">
          <LedgerTable data={data} loading={loading} onRowClick={(to2) => navigate(to2)} />
        </div>
      </Card>

      <PaymentFormModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        fixedParty={party}
        onSaved={() => { load(); onChanged?.(); }}
      />
    </>
  );
}
