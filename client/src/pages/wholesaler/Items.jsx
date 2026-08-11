import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Package, IndianRupee, TriangleAlert, XCircle, Tag,
  Upload, Download, Pencil, Boxes, Trash2, EyeOff, Eye, ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { downloadText } from '@/lib/download';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, StatCard, Button, Select, Table, Badge,
  SearchInput, Chips, Pagination, EmptyState, ConfirmModal, useToast,
} from '@/components/ui';

import ItemFormModal from './items/ItemFormModal';
import StockModal from './items/StockModal';
import CategoryModal from './items/CategoryModal';
import ImportModal from './items/ImportModal';
import ItemCard from './items/ItemCard';

const SORTS = [
  { value: 'name', label: 'Naam (A-Z)' },
  { value: '-name', label: 'Naam (Z-A)' },
  { value: 'stockQty', label: 'Stock (kam pehle)' },
  { value: '-stockQty', label: 'Stock (zyada pehle)' },
  { value: '-createdAt', label: 'Naye pehle' },
  { value: '-salePrice', label: 'Mehnga pehle' },
];

export default function Items() {
  const toast = useToast();
  const { gstEnabled } = useAuth();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ totalItems: 0, stockValue: 0, lowStock: 0, outOfStock: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState([]);
  const [formItem, setFormItem] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [stockItem, setStockItem] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.categories);
    } catch { /* chup-chaap */ }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/items/stats');
      setStats(res.data);
    } catch { /* chup-chaap */ }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/items', {
        params: { q: debouncedQ, categoryId, stock, sort, page, limit: 25 },
      });
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, categoryId, stock, sort, page]);

  useEffect(() => { loadCategories(); loadStats(); }, [loadCategories, loadStats]);
  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { setPage(1); }, [debouncedQ, categoryId, stock, sort]);

  function refreshAll() {
    loadItems(); loadStats(); loadCategories(); setSelected([]);
  }

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allSelected = items.length > 0 && selected.length === items.length;
  const toggleSelectAll = () => setSelected(allSelected ? [] : items.map((i) => i._id));

  async function runBulk(action, extra = {}) {
    setBusy(true);
    try {
      const res = await api.post('/items/bulk', { ids: selected, action, ...extra });
      toast.success(res.message);
      setConfirmBulk(null);
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const res = await api.get('/items/export');
      downloadText('rakhrakhav-items.csv', res.data.csv);
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  }

  const hasFilters = Boolean(debouncedQ || categoryId || stock !== 'all');

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'select',
        width: 44,
        header: (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-ring"
            aria-label="Sab chunein"
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            checked={selected.includes(row._id)}
            onChange={() => toggleSelect(row._id)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-ring"
            aria-label={`${row.name} chunein`}
          />
        ),
      },
      {
        key: 'name',
        header: 'Item',
        render: (row) => (
          <div className="flex items-center gap-3">
            {row.imageUrl ? (
              <img src={row.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <Package size={16} />
              </div>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                {row.name}
                {row.warrantyMonths > 0 && (
                  <ShieldCheck size={13} className="shrink-0 text-emerald-600"
                    aria-label={`${row.warrantyText} warranty`} />
                )}
              </p>
              <p className="truncate text-xs text-slate-500">
                {[row.brand, row.sku, row.category].filter(Boolean).join(' · ') || '—'}
                {row.rack && <span className="text-slate-400"> · {row.rack}</span>}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'stockQty',
        header: 'Stock',
        align: 'right',
        render: (row) => (
          <button onClick={() => setStockItem(row)} className="focus-ring rounded">
            <Badge tone={row.isOutOfStock ? 'red' : row.isLowStock ? 'amber' : 'green'}>
              {row.isOutOfStock ? 'Khatam' : formatQty(row.stockQty, row.unit)}
            </Badge>
          </button>
        ),
      },
      { key: 'purchasePrice', header: 'Purchase', align: 'right', render: (r) => formatMoney(r.purchasePrice) },
      { key: 'salePrice', header: 'Sale', align: 'right', render: (r) => formatMoney(r.salePrice) },
      {
        key: 'wholesalePrice',
        header: 'Wholesale',
        align: 'right',
        render: (r) => (
          <span className={r.wholesalePrice ? 'font-medium text-slate-900' : 'text-slate-400'}>
            {r.wholesalePrice ? formatMoney(r.wholesalePrice) : '—'}
          </span>
        ),
      },
    ];

    if (gstEnabled) {
      cols.push({ key: 'gstRate', header: 'GST', align: 'right', render: (r) => `${r.gstRate || 0}%` });
    }

    cols.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setStockItem(row)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Stock badlein"
          >
            <Boxes size={16} />
          </button>
          <button
            onClick={() => { setFormItem(row); setFormOpen(true); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Edit"
          >
            <Pencil size={16} />
          </button>
        </div>
      ),
    });

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, allSelected, items, gstEnabled]);

  return (
    <>
      <PageHeader
        title="Items"
        subtitle="Aapka saara maal, stock aur rate"
        action={
          <>
            <Button variant="secondary" icon={Tag} onClick={() => setCategoryOpen(true)}>
              <span className="hidden sm:inline">Categories</span>
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="secondary" icon={Download} onClick={handleExport}>
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button icon={Plus} onClick={() => { setFormItem(null); setFormOpen(true); }}>
              Naya item
            </Button>
          </>
        }
      />

      {/* ---- Stats ---- */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Kul items" value={stats.totalItems} icon={Package} tone="brand" />
        <StatCard label="Stock ki keemat" value={formatMoney(stats.stockValue)} icon={IndianRupee}
          tone="green" sub="Purchase price se" />
        <StatCard label="Low stock" value={stats.lowStock} icon={TriangleAlert} tone="amber" />
        <StatCard label="Khatam" value={stats.outOfStock} icon={XCircle} tone="red" />
      </div>

      {/* ---- Filters ---- */}
      <Card className="mb-5" padding={false}>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Naam, brand, SKU, model ya barcode..."
            className="lg:w-72" />

          <Chips
            value={stock}
            onChange={setStock}
            options={[
              { value: 'all', label: 'Sab' },
              { value: 'low', label: 'Low stock', count: stats.lowStock },
              { value: 'out', label: 'Khatam', count: stats.outOfStock },
            ]}
          />

          <div className="flex flex-1 gap-3 lg:max-w-md">
            <Select placeholder="Sab categories" value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: 'none', label: 'Bina category' },
                ...categories.map((c) => ({ value: c._id, label: `${c.name} (${c.itemCount})` })),
              ]} />
            <Select placeholder="" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS} />
          </div>
        </div>

        {/* ---- Bulk bar ---- */}
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-brand-50 px-4 py-3">
            <span className="text-sm font-medium text-brand-900">{selected.length} chune gaye</span>
            <div className="flex-1" />
            <Button size="sm" variant="secondary" icon={Eye} onClick={() => runBulk('showToRetailers')}>
              Dikhayein
            </Button>
            <Button size="sm" variant="secondary" icon={EyeOff} onClick={() => runBulk('hideFromRetailers')}>
              Chhupayein
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmBulk('delete')}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Cancel</Button>
          </div>
        )}
      </Card>

      {/* ---- List ---- */}
      <Card padding={false}>
        {!loading && !items.length ? (
          <EmptyState
            icon={Package}
            title={hasFilters ? 'Is filter me kuch nahi mila' : 'Abhi koi item nahi hai'}
            message={
              hasFilters
                ? 'Filter hata kar dobara dekhein.'
                : 'Pehla item add karein, ya Excel/CSV se ek saath sab import kar lein.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => { setQ(''); setCategoryId(''); setStock('all'); }}>
                  Filter hatayein
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button icon={Plus} onClick={() => { setFormItem(null); setFormOpen(true); }}>
                    Pehla item add karein
                  </Button>
                  <Button variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>
                    CSV import
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table columns={columns} rows={items} loading={loading} />
            </div>

            {/* Mobile */}
            <div className="md:hidden">
              {loading ? (
                <p className="py-12 text-center text-sm text-slate-400">Load ho raha hai...</p>
              ) : (
                items.map((item) => (
                  <ItemCard
                    key={item._id}
                    item={item}
                    selected={selected.includes(item._id)}
                    onSelect={toggleSelect}
                    onEdit={(i) => { setFormItem(i); setFormOpen(true); }}
                    onStock={setStockItem}
                  />
                ))
              )}
            </div>

            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>

      {/* ---- Modals ---- */}
      <ItemFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={formItem}
        categories={categories}
        onSaved={refreshAll}
        onCategoryAdded={(c) => setCategories((list) => [...list, { ...c, itemCount: 0 }])}
      />

      <StockModal
        open={Boolean(stockItem)}
        onClose={() => setStockItem(null)}
        item={stockItem}
        onSaved={refreshAll}
      />

      <CategoryModal open={categoryOpen} onClose={() => setCategoryOpen(false)} onChanged={refreshAll} />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refreshAll} />

      <ConfirmModal
        open={confirmBulk === 'delete'}
        onClose={() => setConfirmBulk(null)}
        onConfirm={() => runBulk('delete')}
        loading={busy}
        title={`${selected.length} item delete karein?`}
        message="Jo item kisi purane bill ya purchase me hain wo delete nahi honge — sirf hide ho jayenge, taaki purane record kharab na hon."
        confirmLabel="Haan, delete karein"
      />
    </>
  );
}
