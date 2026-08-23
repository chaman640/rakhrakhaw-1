import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PackagePlus, ArrowRight, ArrowLeft, SkipForward, Check, CheckCircle2, Ban,
  TriangleAlert, Receipt, Package, Sparkles,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, prime, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty, formatDate } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, Button, Badge, Input, Select, Spinner, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * EK EK ITEM — "ADD KARKE AAGE".
 *
 * Bees item ka bill ek hi bade form me dikhana sabse aasan tha. Wo galat hota:
 * phone pe wo form teen screen lamba ho jata, aur har line pe do faisle karne
 * hote — "ye mera kaunsa item hai" aur "ise bechunga kitne me". Aisa form log
 * bharte nahi; wo aadha bhar kar chhod dete hain, aur aadha bhara hua kaam
 * poore na hone se bhi bura hai.
 *
 * Isliye ek waqt me EK item. Saamne teen cheezein hoti hain: bill me kya likha
 * hai, wo mera kaunsa item hai, aur bechne ka rate. Ek button — "Add karke
 * aage" — aur agla item khud aa jata hai.
 *
 * Har faisla usi waqt server pe likh jata hai, aakhir me nahi. Beech me app
 * band ho jaye to kaam wahin se shuru hota hai jahan chhoda tha.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STOCK YAHAN SE NAHI BADHTA.
 *
 * Ye page sirf FAISLE leta hai. Maal aakhri kadam pe chadhta hai, ek hi baar,
 * poore bill ka — aur wahi purana `createPurchase()` chalta hai. Isi wajah se
 * is raste se aaya maal aur haath se ki hui kharid — dono ka stock, khep, GST
 * aur khata bilkul ek jaise bante hain.
 * ─────────────────────────────────────────────────────────────────────────
 */

const UNITS = ['PCS', 'BOX', 'PKT', 'SET', 'PAIR', 'DOZ', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'FT', 'BAG', 'BUNDLE'];
const GST_RATES = ['0', '0.25', '3', '5', '12', '18', '28'];
const MARKUPS = [10, 20, 30];

export default function IntakeReview() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { gstEnabled } = useAuth();

  const { data: intake, loading, refetch } = useQuery(
    ['intake', id],
    () => api.get(`/stock-intake/${id}`).then((r) => r.data),
    { poll: false, onError: (err) => toast.error(err.message) },
  );

  const [index, setIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');

  // Pehla wo item jiska faisla baaki hai — wahin se kaam shuru hota hai
  const firstPending = useMemo(
    () => (intake?.lines || []).findIndex((l) => l.status === 'PENDING'),
    [intake],
  );

  useEffect(() => {
    if (intake && index === null) setIndex(firstPending >= 0 ? firstPending : -1);
  }, [intake, index, firstPending]);

  if (loading || !intake) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }

  /* ─── ho chuka / cancel ─── */
  if (intake.status === 'DONE') {
    return (
      <>
        <PageHeader title={t('Maal stock me aa gaya')} subtitle={intake.sellerName} />
        <Card>
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {t('{n} item aapke stock me chadh gaye', { n: intake.addedCount })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t('Bill {no} · {date}', {
                  no: intake.sourceInvoiceNo, date: formatDate(intake.invoiceDate),
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {intake.purchaseId && (
              <Button icon={Receipt} onClick={() => navigate(`/purchases/${intake.purchaseId}`)}>
                {t('Purchase dekhein')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/stock-intake')}>
              {t('Baaki kaam dekhein')}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  if (intake.status === 'CANCELLED') {
    return (
      <>
        <PageHeader title={t('Ye bill cancel ho gaya')} subtitle={intake.sellerName} />
        <Card>
          <div className="flex items-start gap-3">
            <Ban size={20} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm text-slate-900">{intake.cancelReason || t('Bechne wale ne bill cancel kar diya')}</p>
              <p className="mt-1 text-sm text-slate-500">
                {t('Is maal ko stock me daalne ki zarurat nahi.')}
              </p>
            </div>
          </div>
          <Button className="mt-4" variant="secondary" onClick={() => navigate('/stock-intake')}>
            {t('Baaki kaam dekhein')}
          </Button>
        </Card>
      </>
    );
  }

  const done = intake.itemCount - intake.pendingCount;
  const line = index >= 0 ? intake.lines[index] : null;

  /** Faisla server pe likh do, phir agle item pe */
  async function decide(body) {
    setSaving(true);
    try {
      const res = await api.post(`/stock-intake/${id}/lines/${index}`, body);
      prime(['intake', id], res.data);
      bust('stock-intake', 'items');
      toast.info(res.message);

      const next = (res.data.lines || []).findIndex((l) => l.status === 'PENDING');
      setIndex(next >= 0 ? next : -1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  /** Pichhla faisla wapas kholo */
  async function goBack() {
    const prev = [...intake.lines]
      .map((l, i) => ({ l, i }))
      .filter((x) => x.l.status !== 'PENDING' && (index < 0 || x.i < index))
      .pop();
    if (!prev) return;

    setSaving(true);
    try {
      const res = await api.delete(`/stock-intake/${id}/lines/${prev.i}`);
      prime(['intake', id], res.data);
      setIndex(prev.i);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      const res = await api.post(`/stock-intake/${id}/finish`, {
        paidAmount: Number(paidAmount || 0),
      });
      prime(['intake', id], res.data.intake);
      // Stock, khep, khata aur purchase — sab badle hain
      bust('stock-intake', 'items', 'purchases', 'khata', 'dashboard', 'reports');
      toast.success(res.message);
      await refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('Maal stock me daalein')}
        subtitle={t('{naam} · bill {no}', { naam: intake.sellerName, no: intake.sourceInvoiceNo })}
      />

      {/* ─── kitna ho gaya ─── */}
      <Card className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {t('{a} / {b} item ho gaye', { a: done, b: intake.itemCount })}
          </span>
          <span className="tabular text-slate-500">{formatMoney(intake.grandTotal)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${intake.itemCount ? (done / intake.itemCount) * 100 : 0}%` }}
          />
        </div>
      </Card>

      {line ? (
        <LineStep
          key={index}
          intakeId={id}
          index={index}
          line={line}
          gstEnabled={gstEnabled}
          saving={saving}
          canGoBack={done > 0}
          onBack={goBack}
          onDecide={decide}
        />
      ) : (
        <FinishStep
          intake={intake}
          gstEnabled={gstEnabled}
          paidAmount={paidAmount}
          setPaidAmount={setPaidAmount}
          finishing={finishing}
          onBack={goBack}
          onFinish={finish}
        />
      )}
    </>
  );
}

/* ══════════════════════════ ek item ka kadam ══════════════════════════ */

function LineStep({ intakeId, index, line, gstEnabled, saving, canGoBack, onBack, onDecide }) {
  const toast = useToast();

  // Lagat — GST wale ke liye tax ke bina, bina GST wale ke liye tax ke saath
  // (StockIntake.js me poori wajah)
  const cost = gstEnabled ? line.unitCostExTax : line.unitCostIncTax;

  const { data, loading } = useQuery(
    ['intake-matches', intakeId, index],
    () => api.get(`/stock-intake/${intakeId}/lines/${index}/matches`).then((r) => r.data),
    { poll: false, onError: (err) => toast.error(err.message) },
  );

  const matches = data?.matches || [];

  const [choice, setChoice] = useState(null);         // itemId ya 'new'
  const [price, setPrice] = useState('');
  const [newItem, setNewItem] = useState({
    name: line.sourceName, sku: '', unit: line.unit,
    hsn: line.hsn || '', gstRate: String(line.gstRate ?? 0),
  });

  /*
    Pehla andaza app khud lagati hai — par sirf tab jab wo PAKKA ho.

    "Shayad" wale milaan pe apne aap tick laga dena sabse khatarnak hota: aadmi
    aadhi nazar se dekh kar "Add karke aage" daba deta hai, aur galat item me
    maal chadh jata hai. Wo galti stock aur lagat dono me ghus jati hai, aur
    mahino baad pakdi jati hai.
  */
  useEffect(() => {
    if (!data || choice !== null) return;
    const sure = matches.find((m) => m.sure);
    if (sure) {
      setChoice(String(sure._id));
      setPrice(sure.salePrice > 0 ? String(sure.salePrice) : '');
    } else {
      setChoice('new');
    }
  }, [data, matches, choice]);

  const picked = matches.find((m) => String(m._id) === String(choice)) || null;
  const priceNum = Number(price || 0);
  const margin = priceNum > 0 && cost > 0 ? priceNum - cost : 0;
  const marginPct = cost > 0 && priceNum > 0 ? ((priceNum - cost) / cost) * 100 : 0;

  function submit() {
    if (!(priceNum > 0)) {
      toast.error(t('Bechne ka rate daalein'));
      return;
    }
    if (choice === 'new') {
      onDecide({
        sellingPrice: priceNum,
        newItem: {
          name: newItem.name.trim(),
          sku: newItem.sku.trim(),
          unit: newItem.unit,
          hsn: newItem.hsn.trim(),
          gstRate: Number(newItem.gstRate || 0),
        },
      });
    } else {
      onDecide({ sellingPrice: priceNum, itemId: choice });
    }
  }

  return (
    <div className="space-y-5">
      {/* ─── bill me kya likha hai ─── */}
      <Card>
        <CardHeader title={t('Bill me ye likha hai')} />
        <p className="text-lg font-semibold text-slate-900">{line.sourceName}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="tabular">
            {t('{q} × {r}', { q: formatQty(line.qty, line.unit), r: formatMoney(line.rate) })}
          </span>
          {line.gstRate > 0 && <span>{t('GST {n}%', { n: line.gstRate })}</span>}
          {line.hsn && <span className="text-slate-400">HSN {line.hsn}</span>}
          <span className="tabular ml-auto font-semibold text-slate-900">{formatMoney(line.total)}</span>
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {t('Aapko pada: {a} / {u}', { a: formatMoney(cost), u: line.unit })}
          {!gstEnabled && line.taxAmount > 0 && (
            <span className="block text-xs text-slate-500">
              {t('(GST bhi isme jud gaya — aapki dukaan GST me registered nahi hai)')}
            </span>
          )}
        </p>
      </Card>

      {/* ─── kaunsa item ─── */}
      <Card>
        <CardHeader
          title={t('Ye aapka kaunsa item hai?')}
          subtitle={t('Mil jaye to usi ka stock badhega, warna naya ban jayega')}
        />

        {loading ? (
          <div className="flex justify-center py-6 text-slate-400"><Spinner size={22} /></div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <button
                key={m._id}
                type="button"
                onClick={() => {
                  setChoice(String(m._id));
                  setPrice(m.salePrice > 0 ? String(m.salePrice) : price);
                }}
                aria-pressed={String(choice) === String(m._id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-ring',
                  String(choice) === String(m._id)
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                <span className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  String(choice) === String(m._id)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300',
                )}>
                  {String(choice) === String(m._id) && <Check size={13} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">{m.name}</span>
                    {m.sure
                      ? <Badge tone="green">{t('Pakka yahi')}</Badge>
                      : <Badge tone="slate">{t('Shayad')}</Badge>}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {t('Abhi {q}', { q: formatQty(m.stockQty, m.unit) })}
                    {m.salePrice > 0 && ` · ${t('bech rahe {a}', { a: formatMoney(m.salePrice) })}`}
                  </span>
                </span>
              </button>
            ))}

            {/* ─── naya item ─── */}
            <button
              type="button"
              onClick={() => setChoice('new')}
              aria-pressed={choice === 'new'}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-ring',
                choice === 'new' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <span className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                choice === 'new' ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300',
              )}>
                {choice === 'new' && <Check size={13} />}
              </span>
              <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Package size={15} className="text-slate-400" />
                {t('Naya item banayein')}
              </span>
            </button>

            {choice === 'new' && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
                <Input
                  label={t('Item ka naam')}
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
                  containerClassName="sm:col-span-2"
                />
                <Select
                  label={t('Unit')}
                  options={UNITS}
                  value={newItem.unit}
                  onChange={(e) => setNewItem((s) => ({ ...s, unit: e.target.value }))}
                  placeholder=""
                />
                <Input
                  label={t('Apna code')}
                  value={newItem.sku}
                  onChange={(e) => setNewItem((s) => ({ ...s, sku: e.target.value }))}
                  hint={t('Marzi se — apne godown ka code')}
                />
                {gstEnabled && (
                  <>
                    <Input
                      label={t('HSN')}
                      value={newItem.hsn}
                      onChange={(e) => setNewItem((s) => ({ ...s, hsn: e.target.value }))}
                    />
                    <Select
                      label={t('GST rate')}
                      value={newItem.gstRate}
                      onChange={(e) => setNewItem((s) => ({ ...s, gstRate: e.target.value }))}
                      placeholder=""
                      options={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ─── bechne ka rate ─── */}
      <Card>
        <CardHeader
          title={t('Bechne ka rate')}
          subtitle={t('Ye rate item pe lag jayega — baad me Items page se badal sakte hain')}
        />

        <Input
          label={t('Ek {u} kitne ka bechenge', { u: line.unit })}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          prefix="₹"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        {/*
          Ek tap me rate — lagat pe itna jodo.

          Ye zabardasti nahi hai, madad hai: number khud bhi likh sakte hain.
          Par bees item pe har baar guna karna aadmi ko thaka deta hai, aur
          thaka hua aadmi rate galat daal deta hai.
        */}
        {cost > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Sparkles size={12} /> {t('Lagat pe jodein')}
            </span>
            {MARKUPS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPrice(String(Math.round(cost * (1 + pct / 100) * 100) / 100))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-ring"
              >
                {t('+{n}%', { n: pct })}
              </button>
            ))}
          </div>
        )}

        {priceNum > 0 && cost > 0 && (
          <p className={cn('mt-3 rounded-lg px-3 py-2 text-sm',
            margin > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
            {margin > 0 ? (
              t('Munafa {a} per {u} ({p}%)', {
                a: formatMoney(margin), u: line.unit, p: marginPct.toFixed(1),
              })
            ) : (
              <span className="flex items-center gap-1.5">
                <TriangleAlert size={14} />
                {t('Ye rate lagat se kam hai — har bikri pe nuksaan hoga')}
              </span>
            )}
          </p>
        )}
      </Card>

      {/* ─── button ─── */}
      <div className="sticky bottom-20 flex flex-wrap items-center gap-2 lg:bottom-4">
        {canGoBack && (
          <Button variant="ghost" icon={ArrowLeft} onClick={onBack} disabled={saving}>
            {t('Peeche')}
          </Button>
        )}
        <Button
          variant="secondary"
          icon={SkipForward}
          onClick={() => onDecide({ skip: true })}
          disabled={saving}
        >
          {t('Chhod dein')}
        </Button>
        <Button
          className="ml-auto shadow-lg"
          size="lg"
          icon={ArrowRight}
          loading={saving}
          onClick={submit}
        >
          {t('Add karke aage')}
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════ aakhri kadam ══════════════════════════ */

function FinishStep({ intake, gstEnabled, paidAmount, setPaidAmount, finishing, onBack, onFinish }) {
  const added = intake.lines.filter((l) => l.status === 'ADDED');
  const skipped = intake.lines.filter((l) => l.status === 'SKIPPED');

  const total = added.reduce((s, l) => s + (l.total || 0), 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={t('Sab tay ho gaya — ek baar dekh lijiye')}
          subtitle={t('Ab ye maal aapke stock me chadhega aur ek purchase ban jayegi')}
        />

        <ul className="divide-y divide-slate-100">
          {added.map((l, i) => (
            <li key={`a${i}`} className="flex items-center gap-3 py-2.5">
              <Check size={15} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-900">{l.sourceName}</span>
                <span className="block text-xs text-slate-500">
                  {t('{q} · bechenge {a}', {
                    q: formatQty(l.qty, l.unit), a: formatMoney(l.sellingPrice),
                  })}
                  {l.createdNewItem && ` · ${t('naya item')}`}
                </span>
              </span>
              <span className="tabular shrink-0 text-sm text-slate-700">{formatMoney(l.total)}</span>
            </li>
          ))}

          {skipped.map((l, i) => (
            <li key={`s${i}`} className="flex items-center gap-3 py-2.5 opacity-60">
              <SkipForward size={15} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-500 line-through">
                {l.sourceName}
              </span>
              <Badge tone="slate">{t('Chhoda')}</Badge>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-medium text-slate-700">
            {t('{n} item stock me jayenge', { n: added.length })}
          </span>
          <span className="tabular text-lg font-semibold text-slate-900">{formatMoney(total)}</span>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t('Paisa')}
          subtitle={t('{naam} ke khate me poora udhaar chadh jayega — abhi kuch diya ho to yahan likh dein', {
            naam: intake.sellerName,
          })}
        />
        <Input
          label={t('Abhi kitna diya')}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          prefix="₹"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          hint={t('Khali chhod dein to poora udhaar')}
        />
        {!gstEnabled && intake.taxTotal > 0 && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {t('Aapki dukaan GST me registered nahi hai, isliye bill ka GST aapki lagat me jud gaya hai — jod bill se poora milta hai.')}
          </p>
        )}
      </Card>

      {!added.length && (
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="flex items-start gap-2 text-sm text-amber-900">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {t('Ek bhi item add nahi kiya — peeche jaakar kam se kam ek chun lein.')}
          </p>
        </Card>
      )}

      <div className="sticky bottom-20 flex flex-wrap items-center gap-2 lg:bottom-4">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack} disabled={finishing}>
          {t('Peeche')}
        </Button>
        <Button
          className="ml-auto shadow-lg"
          size="lg"
          icon={PackagePlus}
          loading={finishing}
          disabled={!added.length}
          onClick={onFinish}
        >
          {t('Stock me daal dein')}
        </Button>
      </div>
    </div>
  );
}
