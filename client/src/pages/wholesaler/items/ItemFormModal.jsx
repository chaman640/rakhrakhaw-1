import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Package, Plus } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/format';
import { Modal, Button, Input, Select, Textarea, Switch, useToast } from '@/components/ui';

const UNITS = ['PCS', 'BOX', 'PKT', 'SET', 'PAIR', 'DOZ', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'FT', 'BAG', 'BUNDLE'];
const GST_RATES = ['0', '0.25', '3', '5', '12', '18', '28'];

const blank = {
  name: '', sku: '', description: '', categoryId: '', unit: 'PCS',
  purchasePrice: '', salePrice: '', wholesalePrice: '',
  openingStock: '', lowStockAt: '5',
  hsn: '', gstRate: '0', visibleToRetailers: true,
};

export default function ItemFormModal({ open, onClose, item, categories, onSaved, onCategoryAdded }) {
  const { gstEnabled, business } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const isEdit = Boolean(item?._id);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [photo, setPhoto] = useState({ url: '', pendingFile: null });

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setNewCategory('');
    setAddingCategory(false);

    if (item?._id) {
      setForm({
        name: item.name || '',
        sku: item.sku || '',
        description: item.description || '',
        categoryId: item.categoryId || '',
        unit: item.unit || 'PCS',
        purchasePrice: String(item.purchasePrice ?? ''),
        salePrice: String(item.salePrice ?? ''),
        wholesalePrice: String(item.wholesalePrice ?? ''),
        openingStock: '',
        lowStockAt: String(item.lowStockAt ?? 5),
        hsn: item.hsn || '',
        gstRate: String(item.gstRate ?? 0),
        visibleToRetailers: item.visibleToRetailers !== false,
      });
      setPhoto({ url: item.imageUrl || '', pendingFile: null });
    } else {
      setForm({ ...blank, lowStockAt: String(business?.lowStockThreshold ?? 5) });
      setPhoto({ url: '', pendingFile: null });
    }
  }, [open, item, business]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const cost = Number(form.purchasePrice || 0);
  const sell = Number(form.wholesalePrice || form.salePrice || 0);
  const margin = cost > 0 && sell > 0
    ? { amount: sell - cost, percent: ((sell - cost) / cost) * 100 }
    : null;

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Image 3 MB se choti honi chahiye'); return; }
    setPhoto({ url: URL.createObjectURL(file), pendingFile: file });
  }

  async function uploadPhotoFor(itemId) {
    if (!photo.pendingFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', photo.pendingFile);
      await api.post(`/items/${itemId}/photo`, fd);
    } catch (err) {
      toast.error('Photo upload nahi hui: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (isEdit && photo.url && !photo.pendingFile) {
      try { await api.delete(`/items/${item._id}/photo`); } catch { /* ignore */ }
    }
    setPhoto({ url: '', pendingFile: null });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    try {
      const res = await api.post('/categories', { name });
      onCategoryAdded?.(res.data);
      setForm((f) => ({ ...f, categoryId: res.data._id }));
      setNewCategory('');
      setAddingCategory(false);
      toast.success(`"${name}" category ban gayi`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId || null,
      unit: form.unit,
      purchasePrice: Number(form.purchasePrice || 0),
      salePrice: Number(form.salePrice || 0),
      wholesalePrice: Number(form.wholesalePrice || 0),
      lowStockAt: Number(form.lowStockAt || 0),
      hsn: form.hsn.trim(),
      gstRate: Number(form.gstRate || 0),
      visibleToRetailers: form.visibleToRetailers,
    };
    if (!isEdit) payload.openingStock = Number(form.openingStock || 0);

    try {
      const res = isEdit
        ? await api.put(`/items/${item._id}`, payload)
        : await api.post('/items', payload);

      await uploadPhotoFor(res.data._id);

      toast.success(isEdit ? 'Item save ho gaya' : `${payload.name} add ho gaya`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
      if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Item edit karein' : 'Naya item'}
      description={isEdit ? item?.name : 'Stock, price aur category bharein'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button onClick={handleSubmit} loading={saving || uploading} type="button">
            {isEdit ? 'Save karein' : 'Add karein'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ---- Photo ---- */}
        <div className="flex items-center gap-4">
          {photo.url ? (
            <img src={photo.url} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Package size={24} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
              className="hidden" onChange={pickPhoto} data-testid="item-photo-input" />
            <Button type="button" variant="secondary" size="sm" icon={Upload}
              onClick={() => fileRef.current?.click()}>
              {photo.url ? 'Photo badlein' : 'Photo lagayein'}
            </Button>
            {photo.url && (
              <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={removePhoto}>
                Hatayein
              </Button>
            )}
          </div>
        </div>

        {/* ---- Basic ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Item ka naam" required autoFocus placeholder="Bearing 6203"
            value={form.name} onChange={set('name')} error={fieldErrors.name}
            containerClassName="sm:col-span-2" />

          <Input label="Code / SKU" placeholder="BRG-6203" value={form.sku} onChange={set('sku')}
            hint="Apni pehchaan ke liye, marzi ho to chhod dein" />

          <Select label="Unit" options={UNITS} value={form.unit} onChange={set('unit')} placeholder="" />

          <div className="sm:col-span-2">
            {!addingCategory ? (
              <div className="flex items-end gap-2">
                <Select
                  label="Category"
                  placeholder="Bina category"
                  options={categories.map((c) => ({ value: c._id, label: c.name }))}
                  value={form.categoryId}
                  onChange={set('categoryId')}
                />
                <Button type="button" variant="secondary" icon={Plus} onClick={() => setAddingCategory(true)}>
                  Nayi
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <Input label="Nayi category ka naam" value={newCategory} autoFocus
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                <Button type="button" onClick={addCategory}>Add</Button>
                <Button type="button" variant="ghost" onClick={() => setAddingCategory(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>

        {/* ---- Prices ---- */}
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Price</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Purchase price" type="number" step="0.01" min="0" prefix="₹"
              value={form.purchasePrice} onChange={set('purchasePrice')}
              hint="Aapko kitne ka pada" error={fieldErrors.purchasePrice} />
            <Input label="Sale price" type="number" step="0.01" min="0" prefix="₹"
              value={form.salePrice} onChange={set('salePrice')}
              hint="Counter / default rate" error={fieldErrors.salePrice} />
            <Input label="Wholesale price" type="number" step="0.01" min="0" prefix="₹"
              value={form.wholesalePrice} onChange={set('wholesalePrice')}
              hint="Retailers ko yahi dikhega" error={fieldErrors.wholesalePrice} />
          </div>

          {margin && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              margin.amount >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
            }`}>
              {margin.amount >= 0 ? 'Fayda' : 'Nuksan'}: <strong>{formatMoney(Math.abs(margin.amount))}</strong>
              {' '}per {form.unit} ({margin.percent.toFixed(1)}%)
            </p>
          )}
        </div>

        {/* ---- Stock ---- */}
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Stock</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {isEdit ? (
              <Input label="Abhi ka stock" value={`${item.stockQty} ${item.unit}`} disabled
                hint='Badalne ke liye list me "Stock" button dabayein' />
            ) : (
              <Input label="Opening stock" type="number" step="0.01" suffix={form.unit}
                value={form.openingStock} onChange={set('openingStock')}
                hint="Abhi kitna maal pada hai" />
            )}
            <Input label="Low stock warning" type="number" min="0" suffix={form.unit}
              value={form.lowStockAt} onChange={set('lowStockAt')}
              hint="Itne se kam hone par alert" />
          </div>
        </div>

        {/* ---- GST (sirf gstEnabled par) ---- */}
        {gstEnabled && (
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">GST</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="HSN code" placeholder="8482" value={form.hsn} onChange={set('hsn')}
                hint="Tax invoice pe chhapega" />
              <Select label="GST rate" value={form.gstRate} onChange={set('gstRate')} placeholder=""
                options={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))} />
            </div>
          </div>
        )}

        {/* ---- Extra ---- */}
        <Textarea label="Description" rows={2} value={form.description} onChange={set('description')}
          placeholder="Koi khaas baat jo yaad rakhni ho" />

        <Switch
          id="visible-to-retailers"
          checked={form.visibleToRetailers}
          onChange={(v) => setForm((f) => ({ ...f, visibleToRetailers: v }))}
          label="Retailers ko dikhayein"
          description="Off karne par ye item retailer ke catalog me nahi aayega"
        />
      </form>
    </Modal>
  );
}
