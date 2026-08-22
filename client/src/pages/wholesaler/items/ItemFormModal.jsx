import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Package, Plus, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/format';
import { Modal, Button, Input, Select, Textarea, Switch, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const UNITS = ['PCS', 'BOX', 'PKT', 'SET', 'PAIR', 'DOZ', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'FT', 'BAG', 'BUNDLE'];
const GST_RATES = ['0', '0.25', '3', '5', '12', '18', '28'];

const blank = {
  name: '', sku: '', description: '', categoryId: '', unit: 'PCS',
  brand: '', modelNo: '', barcode: '',
  purchasePrice: '', salePrice: '', wholesalePrice: '', mrp: '',
  openingStock: '', lowStockAt: '5', rack: '', minOrderQty: '',
  hsn: '', gstRate: '0',
  warrantyMonths: '0', warrantyNote: '',
  expiryDate: '', mfgDate: '', size: '', shape: '', weight: '', weightUnit: 'KG',
  visibleToRetailers: true,
};

// Wazan ki ikaai — thos aur tarl, dono
const WEIGHT_UNITS = [
  { value: 'G', label: 'gram' },
  { value: 'KG', label: 'kilo' },
  { value: 'ML', label: 'ml' },
  { value: 'LTR', label: 'litre' },
];

// Date ke khaane ko "2026-08-22" chahiye; server poori ISO tareekh bhejta hai
const dateInput = (v) => (v ? String(v).slice(0, 10) : '');

// Jo warranty aam taur pe di jaati hai — type karne ki zarurat na pade
const WARRANTY_PRESETS = [
  { value: '0', label: 'Nahi hai' },
  { value: '1', label: '1 mahina' },
  { value: '3', label: '3 mahine' },
  { value: '6', label: '6 mahine' },
  { value: '12', label: '1 saal' },
  { value: '18', label: '1.5 saal' },
  { value: '24', label: '2 saal' },
  { value: '36', label: '3 saal' },
  { value: '60', label: '5 saal' },
];

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
        brand: item.brand || '',
        modelNo: item.modelNo || '',
        barcode: item.barcode || '',
        purchasePrice: String(item.purchasePrice ?? ''),
        salePrice: String(item.salePrice ?? ''),
        wholesalePrice: String(item.wholesalePrice ?? ''),
        mrp: String(item.mrp ?? ''),
        openingStock: '',
        lowStockAt: String(item.lowStockAt ?? 5),
        rack: item.rack || '',
        minOrderQty: String(item.minOrderQty ?? ''),
        hsn: item.hsn || '',
        gstRate: String(item.gstRate ?? 0),
        warrantyMonths: String(item.warrantyMonths ?? 0),
        warrantyNote: item.warrantyNote || '',
        expiryDate: dateInput(item.expiryDate),
        mfgDate: dateInput(item.mfgDate),
        size: item.size || '',
        shape: item.shape || '',
        weight: String(item.weight || ''),
        weightUnit: item.weightUnit || 'KG',
        visibleToRetailers: item.visibleToRetailers !== false,
      });
      setPhoto({ url: item.imageUrl || '', pendingFile: null });
    } else {
      setForm({ ...blank, lowStockAt: String(business?.lowStockThreshold ?? 5) });
      setPhoto({ url: '', pendingFile: null });
    }
  }, [open, item, business]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Byora wala hissa apne aap khula rahe jab usme kuch bhara ho — warna edit
  // karte waqt bhari hui expiry chhupi rehti aur dikhti hi nahi
  const hasByora = Boolean(form.expiryDate || form.mfgDate || form.size
    || form.shape || Number(form.weight || 0));

  // Expiry me kitne din bache — minus matlab beet chuki
  const expiryDin = form.expiryDate
    ? Math.ceil((new Date(form.expiryDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;

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
      brand: form.brand.trim(),
      modelNo: form.modelNo.trim(),
      barcode: form.barcode.trim(),
      purchasePrice: Number(form.purchasePrice || 0),
      salePrice: Number(form.salePrice || 0),
      wholesalePrice: Number(form.wholesalePrice || 0),
      mrp: Number(form.mrp || 0),
      lowStockAt: Number(form.lowStockAt || 0),
      rack: form.rack.trim(),
      minOrderQty: Number(form.minOrderQty || 0),
      hsn: form.hsn.trim(),
      gstRate: Number(form.gstRate || 0),
      warrantyMonths: Number(form.warrantyMonths || 0),
      warrantyNote: form.warrantyNote.trim(),
      /*
        Khali tareekh `''` nahi, `null` jati hai.

        `''` ko Date me daalte hi "Invalid Date" ban jata hai aur wo poora save
        gira deta hai — aur error bhi aisa aata hai jisse kuch samajh nahi
        aata. Server pe bhi yahi badla hai, par yahan bhi karna theek hai:
        khali ka matlab "likha hi nahi", aur wo `null` hai.
      */
      expiryDate: form.expiryDate || null,
      mfgDate: form.mfgDate || null,
      size: form.size.trim(),
      shape: form.shape.trim(),
      weight: Number(form.weight || 0),
      weightUnit: form.weightUnit,
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
          <Button variant="secondary" onClick={onClose} type="button">{t('Cancel')}</Button>
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
                {t('Hatayein')}
              </Button>
            )}
          </div>
        </div>

        {/* ---- Basic ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Item ka naam')} required autoFocus placeholder={t('Bearing 6203')}
            value={form.name} onChange={set('name')} error={fieldErrors.name}
            containerClassName="sm:col-span-2" />

          <Input label={t('Code / SKU')} placeholder={t('BRG-6203')} value={form.sku} onChange={set('sku')}
            hint={t('Apni pehchaan ke liye, marzi ho to chhod dein')} />

          <Select label={t('Unit')} options={UNITS} value={form.unit} onChange={set('unit')} placeholder="" />

          <div className="sm:col-span-2">
            {!addingCategory ? (
              <div className="flex items-end gap-2">
                <Select
                  label={t('Category')}
                  placeholder={t('Bina category')}
                  options={categories.map((c) => ({ value: c._id, label: c.name }))}
                  value={form.categoryId}
                  onChange={set('categoryId')}
                />
                <Button type="button" variant="secondary" icon={Plus} onClick={() => setAddingCategory(true)}>
                  {t('Nayi')}
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <Input label={t('Nayi category ka naam')} value={newCategory} autoFocus
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                <Button type="button" onClick={addCategory}>{t('Add')}</Button>
                <Button type="button" variant="ghost" onClick={() => setAddingCategory(false)}>{t('Cancel')}</Button>
              </div>
            )}
          </div>
        </div>

        {/* ---- Prices ---- */}
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">{t('Price')}</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label={t('Purchase price')} type="number" step="0.01" min="0" prefix="₹"
              value={form.purchasePrice} onChange={set('purchasePrice')}
              hint={t('Aapko kitne ka pada')} error={fieldErrors.purchasePrice} />
            <Input label={t('Sale price')} type="number" step="0.01" min="0" prefix="₹"
              value={form.salePrice} onChange={set('salePrice')}
              hint={t('Counter / default rate')} error={fieldErrors.salePrice} />
            <Input label={t('Wholesale price')} type="number" step="0.01" min="0" prefix="₹"
              value={form.wholesalePrice} onChange={set('wholesalePrice')}
              hint={t('Retailers ko yahi dikhega')} error={fieldErrors.wholesalePrice} />
            <Input label="MRP" type="number" step="0.01" min="0" prefix="₹"
              value={form.mrp} onChange={set('mrp')}
              hint={t('Packet pe chhapa hua rate — retailer ko dikhega')} error={fieldErrors.mrp} />
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

        {/* ---- Pehchan ---- */}
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-1 text-sm font-semibold text-slate-900">{t('Pehchan')}</h4>
          <p className="mb-3 text-xs text-slate-500">
            {t('Bharna zaroori nahi — par bhar denge to search me foran mil jayega')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('Company / Brand')} placeholder={t('SKF, Bosch, Rolon...')}
              value={form.brand} onChange={set('brand')} />
            <Input label={t('Model / Serial number')} placeholder={t('6203-2RS')}
              value={form.modelNo} onChange={set('modelNo')}
              hint={t('Part number ya serial — dono chalega')} />
            <Input label={t('Barcode')} placeholder="8901234567890"
              value={form.barcode} onChange={set('barcode')}
              hint={t('Scanner se search karne ke liye')} />
            <Input label={t('Rack / jagah')} placeholder={t('A-3')}
              value={form.rack} onChange={set('rack')}
              hint={t('Godown me kahan rakha hai')} />
          </div>
        </div>

        {/* ---- Stock ---- */}
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">{t('Stock')}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {isEdit ? (
              <Input label={t('Abhi ka stock')} value={`${item.stockQty} ${item.unit}`} disabled
                hint={t('Badalne ke liye list me "Stock" button dabayein')} />
            ) : (
              <Input label={t('Opening stock')} type="number" step="0.01" suffix={form.unit}
                value={form.openingStock} onChange={set('openingStock')}
                hint={t('Abhi kitna maal pada hai')} />
            )}
            <Input label={t('Low stock warning')} type="number" min="0" suffix={form.unit}
              value={form.lowStockAt} onChange={set('lowStockAt')}
              hint={t('Itne se kam hone par alert')} />
            <Input label={t('Kam se kam order')} type="number" min="0" suffix={form.unit}
              value={form.minOrderQty} onChange={set('minOrderQty')}
              hint={t('Retailer isse kam order nahi kar payega (0 = koi rok nahi)')} />
          </div>
        </div>

        {/* ---- GST (sirf gstEnabled par) ---- */}
        {gstEnabled && (
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">GST</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t('HSN code')} placeholder="8482" value={form.hsn} onChange={set('hsn')}
                hint={t('Tax invoice pe chhapega')} />
              <Select label={t('GST rate')} value={form.gstRate} onChange={set('gstRate')} placeholder=""
                options={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))} />
            </div>
          </div>
        )}

        {/* ---- Maal ka apna byora — sab marzi se ---- */}
        {/*
          Ye hissa BAND rehta hai jab tak koi khole nahi.

          Wajah wahi jo model me likhi hai: paanchon khaane har dukaan ke kaam
          ke nahi. Bolt bechne wale ko expiry se koi matlab nahi. Har item pe
          paanch khali khaane dikhana form ko lamba aur dara dene wala bana
          deta hai, aur jise sach me zarurat hai wo ek tap me khol lega. Jinme
          kuch bhara hua hai, wo apne aap khula milta hai.
        */}
        <details className="rounded-lg border border-slate-200 p-4" open={hasByora}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 focus-ring">
            <span className="inline-flex items-center gap-2">
              <ChevronRight size={14} className="transition-transform [details[open]_&]:rotate-90" />
              {t('Maal ka byora')}
              <span className="font-normal text-slate-400">{t('(marzi se)')}</span>
            </span>
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            {t('Expiry, size, wazan — jo aapke maal pe lagta ho wahi bharein. Baaki khali chhod dein.')}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Input label={t('Expiry')} type="date" value={form.expiryDate} onChange={set('expiryDate')}
              hint={t('Dawa, oil, khane-peene ka saamaan')} />
            <Input label={t('Banane ki tareekh')} type="date" value={form.mfgDate} onChange={set('mfgDate')} />
            <Input label={t('Size')} placeholder={t('42, XL, 10mm')} value={form.size} onChange={set('size')}
              hint={t('Jo shabd aap bolte hain wahi likhein')} />
            <Input label={t('Shape')} placeholder={t('Gol, chaukor')} value={form.shape} onChange={set('shape')} />
            <Input label={t('Wazan')} type="number" step="0.001" min="0"
              value={form.weight} onChange={set('weight')} />
            <Select label={t('Wazan ki ikaai')} value={form.weightUnit} placeholder=""
              onChange={set('weightUnit')} options={WEIGHT_UNITS} />
          </div>
          {expiryDin !== null && (
            <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs',
              expiryDin < 0 ? 'bg-red-50 text-red-800'
                : expiryDin <= 30 ? 'bg-amber-50 text-amber-900'
                  : 'bg-slate-50 text-slate-600')}>
              {expiryDin < 0
                ? `Ye maal ${Math.abs(expiryDin)} din pehle expire ho chuka hai`
                : expiryDin === 0 ? 'Ye maal aaj expire ho raha hai'
                  : `Expiry me ${expiryDin} din bache hain`}
            </p>
          )}
        </details>

        {/* ---- Warranty ---- */}
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-1 text-sm font-semibold text-slate-900">{t('Warranty')}</h4>
          <p className="mb-3 text-xs text-slate-500">
            {t('Warranty daal denge to retailer ko catalog aur bill — dono jagah dikhegi')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('Kitne din ki')} value={form.warrantyMonths} placeholder=""
              onChange={set('warrantyMonths')} options={WARRANTY_PRESETS} />
            <Input label={t('Warranty ki shart')} placeholder={t('Company warranty, bill ke saath')}
              value={form.warrantyNote} onChange={set('warrantyNote')}
              disabled={form.warrantyMonths === '0'}
              hint={form.warrantyMonths === '0' ? 'Pehle warranty chunein' : 'Bill pe chhapegi'} />
          </div>
          {form.warrantyMonths !== '0' && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Retailer ko dikhega: <span className="font-medium">
                {WARRANTY_PRESETS.find((w) => w.value === form.warrantyMonths)?.label} warranty
              </span>
              {form.warrantyNote && ` — ${form.warrantyNote}`}
            </p>
          )}
        </div>

        {/* ---- Extra ---- */}
        <Textarea label={t('Description')} rows={2} value={form.description} onChange={set('description')}
          placeholder={t('Koi khaas baat jo yaad rakhni ho')} />

        <Switch
          id="visible-to-retailers"
          checked={form.visibleToRetailers}
          onChange={(v) => setForm((f) => ({ ...f, visibleToRetailers: v }))}
          label={t('Retailers ko dikhayein')}
          description={t('Off karne par ye item retailer ke catalog me nahi aayega')}
        />
      </form>
    </Modal>
  );
}
