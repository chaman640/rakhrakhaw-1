import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatDateTime } from '@/lib/format';
import { Card, Table, Badge, EmptyState, useToast } from '@/components/ui';
import { STATUS_TONE, STATUS_LABEL } from '../Orders';

/** Retailer detail ka "Orders" tab */
export default function PartyOrdersTab({ partyId, partyName }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders', { params: { partyId, status: 'all', limit: 50 } })
      .then((r) => setRows(r.data))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  const columns = [
    {
      key: 'orderNo', header: 'Order',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.orderNo}</p>
          <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
        </div>
      ),
    },
    { key: 'itemCount', header: 'Items', align: 'right', render: (r) => r.itemCount },
    { key: 'itemsTotal', header: 'Kul', align: 'right', render: (r) => formatMoney(r.itemsTotal) },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: () => <ChevronRight size={18} className="ml-auto text-slate-300" />,
    },
  ];

  return (
    <Card padding={false}>
      <div className="px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Iske orders</h3>
      </div>

      {!loading && !rows.length ? (
        <EmptyState
          icon={ShoppingCart}
          title="Abhi koi order nahi"
          message={`${partyName} ne apne app se abhi tak koi order nahi bheja.`}
        />
      ) : (
        <div className="border-t border-slate-200">
          <Table columns={columns} rows={rows} loading={loading}
            onRowClick={(r) => navigate(`/orders/${r._id}`)} />
        </div>
      )}
    </Card>
  );
}
