import { useCallback, useState } from 'react';
import api from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { billPdfBlob, billFileName } from '@/lib/billCanvas';
import { shareFile } from '@/lib/share';
import { useToast } from '@/components/ui';

/**
 * "Bhejo" aur "Chhapo" — ek hi jagah, taaki har page pe ek jaisa chale.
 *
 * List me sirf bill ka naam aur rakam hoti hai, poora bill nahi. Isliye
 * bhejne se pehle bill khud mangwana padta hai. Ye chhoti si baat bhoolne se
 * aadha bill jata hai (item gayab), isliye wo yahin ek jagah handle hai.
 */
export function useBillActions() {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  const shareBill = useCallback(async (idOrInvoice) => {
    const id = typeof idOrInvoice === 'string' ? idOrInvoice : idOrInvoice?._id;
    if (!id) return;

    setBusyId(id);
    try {
      // Poora bill chahiye — item, tax, snapshot sab
      const invoice = idOrInvoice?.items
        ? idOrInvoice
        : (await api.get(`/invoices/${id}`)).data;

      const blob = await billPdfBlob(invoice);

      const b = invoice.businessSnapshot || {};
      const party = invoice.partySnapshot || {};
      const lines = [
        `${b.name || ''} — Bill ${invoice.invoiceNo}`,
        `Kul: ${formatMoney(invoice.grandTotal)}`,
        invoice.dueAmount > 0 ? `Baaki: ${formatMoney(invoice.dueAmount)}` : 'Poora mil gaya',
      ];
      if (invoice.dueAmount > 0 && b.upiId) lines.push(`UPI: ${b.upiId}`);

      const result = await shareFile(blob, billFileName(invoice, 'pdf'), {
        title: `Bill ${invoice.invoiceNo}`,
        text: lines.join('\n'),
        phone: party.phone,
      });

      if (result === 'downloaded') {
        toast.info('Bill download ho gaya — WhatsApp me clip wale button se laga dein');
      } else if (result === 'shared') {
        toast.success('Bill bhej diya');
      }
      // 'cancelled' pe kuch nahi — aadmi ne khud band kiya hai
    } catch (err) {
      toast.error(err.message || 'Bill bhej nahi paye');
    } finally {
      setBusyId(null);
    }
  }, [toast]);

  return { shareBill, busyId };
}
