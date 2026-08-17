import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Printer, XCircle, Share2, ShoppingCart, Undo2 } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Card, Button, Badge, Spinner, Modal, Textarea, useToast } from '@/components/ui';
import InvoicePrint from '@/components/invoice/InvoicePrint';
import { useBillActions } from '@/hooks/useBillActions';
import { t } from '@/lib/i18n';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Poora udhaar', partial: 'Kuch mila', paid: 'Poora mil gaya' };

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { shareBill, busyId } = useBillActions();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) {
      toast.error(err.message);
      navigate('/invoices', { replace: true });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function cancel() {
    setBusy(true);
    try {
      const res = await api.post(`/invoices/${id}/cancel`, { reason });
      toast.success(res.message);
      setCancelOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  /*
    Home ki list se "Print" dabane par yahi page `?print=1` ke saath khulta
    hai. Wajah: chhapna hamesha ASLI bill ke sheet se hota hai — list me to
    sirf ek line hoti hai. Ek pal ruk kar chhapte hain, warna kabhi kabhi
    print ka parda aadhe bane page ka photo le leta hai.
  */
  useEffect(() => {
    if (!invoice || params.get('print') !== '1') return undefined;
    const timer = setTimeout(() => {
      window.print();
      params.delete('print');
      setParams(params, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, params]);

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  if (!invoice) return null;

  return (
    <>
      <div className="no-print">
        <Card className="mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{invoice.invoiceNo}</h1>
                {invoice.isCancelled
                  ? <Badge tone="red">{t('Cancelled')}</Badge>
                  : <Badge tone={payTone[invoice.paymentStatus]}>{payLabel[invoice.paymentStatus]}</Badge>}
                <Badge tone={invoice.gstEnabled ? 'brand' : 'slate'}>
                  {invoice.documentType === 'TAX_INVOICE' ? 'Tax Invoice' : 'Bill of Supply'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {invoice.partySnapshot?.shopName || invoice.partySnapshot?.name}
                {' · '}{formatMoney(invoice.grandTotal)}
                {invoice.dueAmount > 0 && <> · baaki {formatMoney(invoice.dueAmount)}</>}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {invoice.orderId && (
                <Link to={`/orders/${invoice.orderId}`}>
                  <Button variant="secondary" size="sm" icon={ShoppingCart}>{t('Order')}</Button>
                </Link>
              )}
              {!invoice.isCancelled && (
                <Button variant="secondary" size="sm" icon={Undo2}
                  onClick={() => navigate(`/returns/new?type=SALE_RETURN&doc=${invoice._id}`)}>
                  {t('Maal wapas aaya')}
                </Button>
              )}
              <Button variant="secondary" size="sm" icon={Share2}
                loading={busyId === invoice._id} onClick={() => shareBill(invoice)}>
                {t('WhatsApp')}
              </Button>
              <Button size="sm" icon={Printer} onClick={() => window.print()}>{t('Print / PDF')}</Button>
              {!invoice.isCancelled && (
                <Button variant="danger" size="sm" icon={XCircle} onClick={() => setCancelOpen(true)}>
                  {t('Cancel')}
                </Button>
              )}
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {t('"WhatsApp" dabate hi bill ki PDF ban kar share ka parda khulta hai — wahan se seedha retailer ko bhej dein. "Print" se kagaz ya PDF, dono ho jate hain.')}
          </p>
        </Card>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <InvoicePrint invoice={invoice} />
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        size="sm"
        title={`${invoice.invoiceNo} cancel karein?`}
        description={t('Bill delete nahi hoga — number record me rahega, par stock wapas aa jayega aur khata ulta ho jayega.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t('Rehne dein')}</Button>
            <Button variant="danger" loading={busy} onClick={cancel}>{t('Haan, cancel karein')}</Button>
          </>
        }
      >
        <Textarea label={t('Wajah (marzi)')} rows={2} value={reason}
          onChange={(e) => setReason(e.target.value)} placeholder={t('Galat rate lag gaya tha')} />
      </Modal>
    </>
  );
}
