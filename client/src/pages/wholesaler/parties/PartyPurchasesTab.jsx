import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Truck, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import { Card, Table, Badge, Button, EmptyState, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Udhaar', partial: 'Kuch diya', paid: 'Diya' };

/** Supplier detail ka "Purchases" tab — isse jo bhi maal aaya */
export default function PartyPurchasesTab({ supplierId, supplierName }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/purchases', { params: { supplierId, limit: 50 } })
      .then((r) => setRows(r.data))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const columns = [
    {
      key: 'purchaseNo', header: t('Purchase'),
      render: (r) => (
        <Link to={`/purchases/${r._id}`} className="block">
          <p className="font-medium text-slate-900">{r.purchaseNo}</p>
          <p className="text-xs text-slate-500">{formatDate(r.purchaseDate)}</p>
        </Link>
      ),
    },
    { key: 'itemCount', header: t('Items'), align: 'right', render: (r) => r.itemCount },
    { key: 'grandTotal', header: t('Kul'), align: 'right', render: (r) => formatMoney(r.grandTotal) },
    {
      key: 'dueAmount', header: t('Baaki'), align: 'right',
      render: (r) => (r.dueAmount > 0
        ? <span className="tabular font-medium text-amber-700">{formatMoney(r.dueAmount)}</span>
        : <span className="text-slate-400">—</span>),
    },
    { key: 'paymentStatus', header: t('Status'),
      render: (r) => <Badge tone={payTone[r.paymentStatus]}>{payLabel[r.paymentStatus]}</Badge> },
  ];

  return (
    <Card padding={false}>
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">{t('Isse aaya maal')}</h3>
        <Button size="sm" icon={Plus} onClick={() => navigate(`/purchases/new?supplier=${supplierId}`)}>
          {t('Nayi purchase')}
        </Button>
      </div>

      {!loading && !rows.length ? (
        <EmptyState
          icon={Truck}
          title={t('Abhi koi purchase nahi')}
          message={`${supplierName} se maal aaye to yahan entry karein \u2014 stock apne aap badh jayega.`}
          action={
            <Button icon={Plus} onClick={() => navigate(`/purchases/new?supplier=${supplierId}`)}>
              {t('Pehli purchase')}
            </Button>
          }
        />
      ) : (
        <div className="border-t border-slate-200">
          <Table columns={columns} rows={rows} loading={loading} onRowClick={(r) => navigate(`/purchases/${r._id}`)} />
        </div>
      )}
    </Card>
  );
}
