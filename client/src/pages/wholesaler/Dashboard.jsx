import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, TrendingUp, TrendingDown, ShoppingCart, Package, Wallet,
  TriangleAlert, ArrowRight, Plus, FileText, UserCheck, Clock, BookOpen,
  Receipt, Truck, CircleAlert, Boxes, Coins, PiggyBank,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useQuery, bust } from '@/hooks/useQuery';
import { formatMoney, formatQty, formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Chips, TrendChart, SkeletonCards, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import ExpenseFormModal from './expenses/ExpenseFormModal';
import { t } from '@/lib/i18n';

const ACTIVITY_ICON = { invoice: Receipt, order: ShoppingCart, payment: Wallet };

/*
  Graph ka arsa naam se. Chart ke sar pe pehle "Pichhle 14 din" pakka likha
  tha, to 1 saal chunne par bhi wahi dikhta rehta tha.

  Ise ek list bana kar ghuma dena zyada saaf lagta hai, par tab har shabd
  `t(x.label)` ban jata — aur anuvaad ki jaanch aise ghume hue shabd ko dekh
  nahi pati. Yahi wo khai hai jisme "Pichhle 14 din" gir gaya tha. Isliye
  yahan har shabd SEEDHA `t()` ke andar likha hai.
*/
function arsaKaNaam(days) {
  if (days === 7) return t('7 din');
  if (days === 30) return t('30 din');
  if (days === 90) return t('3 mahine');
  if (days === 365) return t('1 saal');
  return t('14 din');
}

/**
 * DASHBOARD — "dukaan aaj kaisi chal rahi hai".
 *
 * Step 4 me teen cheezein badli hain, teeno ek hi wajah se: ye page phone pe
 * khulta hai, khade khade, do minute me.
 *
 *  1. **Tile chhote aur do-do karke.** Pehle chaar bade tile the — 390px ke
 *     phone pe wo poori pehli screen kha jate the, aur asli kaam ki cheezein
 *     (chart, kya karna hai) neeche khiskane par hi milti thin. Ab chhah
 *     chhote tile do-do ki line me aate hain aur teeno kaam ki cheez ek hi
 *     screen me aa jati hai.
 *  2. **Chart me kharch bhi.** Sale akeli aadhi baat hai. Ab sale ki line ke
 *     saath kharch ki line hai — dono ke beech ka faasla hi asli jawab hai.
 *  3. **Kharch yahin se likh dein.** Chai ka ₹40 ya petrol ka ₹500 likhne ke
 *     liye poora Kharch page kholna padta tha; aadhe log wahin tal dete the
 *     aur mahine ke aakhir me hisaab galat aata tha. Ab wo button chart ke
 *     upar hi hai.
 *
 * Har hissa `can()` ke peeche hai, par asli rok server pe hai — jiski ijazat
 * nahi, uska data jawab me aata hi nahi.
 */
export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, business, can } = useAuth();
  const [expenseOpen, setExpenseOpen] = useState(false);

  /*
    Chart kitne din ka — dukaandaar chunta hai, aur uska chunav YAAD rehta hai.

    14 din ek achha default hai par jawab sirf ek sawal ka deta hai: "is hafte
    kaisa chal raha hai". "Teen mahine me dhandha badha ya ghata" — wo sawal
    mahine ke aakhir me sabse zyada poochha jata hai, aur uske liye chart
    bekaar tha.

    Chunav `localStorage` me isliye ki har baar dashboard kholte hi wahi range
    mile jo pichhli baar chuni thi. Har baar 14 din pe wapas girna ek chhoti
    si chidh hai jo roz hoti hai.
  */
  const [days, setDays] = useState(() => {
    const saved = Number(localStorage.getItem('rr_trend_days'));
    return [7, 14, 30, 90, 365].includes(saved) ? saved : 14;
  });

  const { data: d, loading } = useQuery(
    ['dashboard', days],
    () => api.get('/dashboard', { params: { days } }).then((r) => r.data),
    { onError: (err) => toast.error(err.message) },
  );

  // Kharch ki shreni sirf tabhi maangte hain jab wo parda khulne wala ho —
  // dashboard har baar khulta hai, ye list roz-roz nahi chahiye
  const { data: categories } = useQuery(
    ['expenses', 'categories'],
    () => api.get('/expenses/categories').then((r) => r.data),
    { enabled: expenseOpen && can('expenses:create') },
  );

  if (loading) {
    return (
      <>
        <div className="mb-6 h-7 w-48 animate-pulse rounded bg-slate-100" />
        <SkeletonCards cards={6} className="lg:grid-cols-6" />
      </>
    );
  }
  if (!d) return null;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Subah bakhair' : hour < 17 ? 'Namaste' : 'Shubh sandhya';

  /*
    Ye chaar label pehle backtick wali line the — `${n} naya order`. Wo
    dikhne me theek lagti hain par anuvaad se poori tarah bahar ho jati hain:
    `t()` unhe kabhi chhoota hi nahi, aur jaanch bhi unhe nahi dekh sakti
    (ander kya banega ye chalne par hi pata chalta hai). Nateeja — English
    chun kar bhi "3 naya order" hi dikhta tha.

    Ab number bhitar `{n}` ban kar jata hai, aur poora vakya kitab me hai.
  */
  const todo = [
    d.todo?.newOrders > 0 && {
      label: t('{n} naya order', { n: d.todo.newOrders }), sub: t('Pack karna hai'),
      icon: ShoppingCart, tone: 'brand', to: '/orders', perm: 'orders',
    },
    d.todo?.pendingPayments > 0 && {
      label: t('{n} payment', { n: d.todo.pendingPayments }), sub: t('Confirm karna hai'),
      icon: Clock, tone: 'amber', to: '/payments?status=pending', perm: 'khata',
    },
    d.todo?.pendingRetailers > 0 && {
      label: t('{n} retailer', { n: d.todo.pendingRetailers }), sub: t('Approve karna hai'),
      icon: UserCheck, tone: 'blue', to: '/retailers', perm: 'parties',
    },
    d.todo?.lowStock > 0 && {
      label: t('{n} item kam', { n: d.todo.lowStock }), sub: t('Mangwa lein'),
      icon: TriangleAlert, tone: 'red', to: '/reports?tab=stock&filter=low', perm: 'reports',
    },
  ].filter(Boolean).filter((row) => !row.perm || can(row.perm));

  /*
    Tile ka kram sirf sajaawat nahi hai — pehla tile wahi hai jo dukaandaar
    subah sabse pehle poochta hai. Jiski ijazat nahi, wo tile list se hi gir
    jata hai (server ne wo hissa bheja hi nahi hota), isliye khaali dabba
    kabhi nahi banta.
  */
  const tiles = [
    d.sale && {
      key: 'sale', label: t('Aaj ki sale'), value: formatMoney(d.sale.today),
      sub: `${d.sale.todayBills} ${t('bill')}`, icon: IndianRupee, tone: 'brand', to: '/sales',
      change: d.sale.changePct,
    },
    d.collection && {
      key: 'coll', label: t('Aaj paisa aaya'), value: formatMoney(d.collection.today),
      sub: `${d.collection.todayCount} ${t('entry')}`, icon: Wallet, tone: 'green', to: '/payments',
    },
    /*
      Udhaar wala tile ab "Lena hai" wali LIST kholta hai, khali Payment page
      nahi.

      Ye chhota sa farak bada tha. Payment page ka pehla tab History hai, to
      "₹24,500 udhaar" pe click karne ke baad saamne aata tha "kaunsi entry kab
      hui" — yani ek aisa jawab jo poochha hi nahi gaya tha. Sawal ye tha:
      "ye ₹24,500 KISKA hai?" Uska jawab "Lena hai" tab me hai, aur ab click
      seedha wahin le jata hai.
    */
    d.khata && {
      key: 'khata', label: t('Udhaar baaki'), value: formatMoney(d.khata.receivable),
      sub: `${d.khata.activeRetailers} ${t('retailer')}`, icon: BookOpen,
      tone: d.khata.receivable > 0 ? 'amber' : 'green', to: '/payments?tab=due',
    },
    // Jama paisa tabhi jab kisi ka ho — warna ek aur khali tile
    d.khata?.advance > 0 && {
      key: 'jama', label: t('Jama paisa'), value: formatMoney(d.khata.advance),
      sub: `${d.khata.advanceParties} ${t('graahak ka')}`, icon: PiggyBank,
      tone: 'brand', to: '/payments?tab=jama',
    },
    d.profit && {
      key: 'profit', label: t('Is mahine bacha'), value: formatMoney(d.profit.month),
      sub: d.profit.marginPct !== null ? `${d.profit.marginPct}% margin` : t('sale ke baad'),
      icon: TrendingUp, tone: d.profit.month >= 0 ? 'green' : 'red', to: '/reports',
    },
    d.expense && {
      key: 'exp', label: t('Aaj ka kharch'), value: formatMoney(d.expense.today),
      sub: `${t('Mahine me')} ${formatMoney(d.expense.month)}`, icon: Coins,
      tone: 'red', to: '/expenses',
    },
    d.sale?.month !== undefined && {
      key: 'month', label: t('Is mahine sale'), value: formatMoney(d.sale.month),
      sub: `${d.sale.monthBills} ${t('bill')}`, icon: FileText, tone: 'brand', to: '/sales',
    },
    /*
      Chhatha tile "Dena hai" hai, "Stock ki keemat" nahi.

      Stock ki keemat isi page pe neeche Stock wale card me pehle se likhi hai —
      ek hi number do jagah dikhane se screen bhar jati hai par kuch naya pata
      nahi chalta. Supplier ko kitna dena hai, wo is page pe kahin nahi tha.
    */
    d.khata && {
      key: 'payable', label: t('Dena hai'), value: formatMoney(d.khata.payable),
      sub: t('Supplier ko'), icon: Boxes,
      tone: d.khata.payable > 0 ? 'red' : 'green', to: '/purchases?tab=dena',
    },
  ].filter(Boolean);

  return (
    <>
      {/* ---- Greeting ---- */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {t(greet)}, {user?.name?.split(' ')[0] || t('Bhai')}
        </h1>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {business?.name} · {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </p>
      </div>

      {/* ---- Aaj kya karna hai ---- */}
      {todo.length > 0 && (
        <Card className="mb-4 border-brand-200 bg-brand-50/40">
          <CardHeader title={t('Aaj ye dekh lijiye')} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {todo.map((row) => (
              <button key={row.label} onClick={() => navigate(row.to)}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand-300 focus-ring">
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  { brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-700',
                    blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700' }[row.tone])}>
                  <row.icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{t(row.label)}</p>
                  <p className="truncate text-xs text-slate-500">{row.sub}</p>
                </div>
                <ArrowRight size={15} className="shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Chhote tile, phone pe do-do ---- */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {tiles.map((tile) => <Tile key={tile.key} {...tile} onClick={() => navigate(tile.to)} />)}
      </div>

      {/* ---- Chart + orders/stock ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {d.trend && (
          <Card className="lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{t('Sale aur kharch')}</h3>
              <Chips
                value={String(days)}
                onChange={(v) => {
                  setDays(Number(v));
                  try { localStorage.setItem('rr_trend_days', v); } catch { /* private mode */ }
                }}
                options={[
                  { value: '7', label: t('7 din') },
                  { value: '14', label: t('14 din') },
                  { value: '30', label: t('30 din') },
                  { value: '90', label: t('3 mahine') },
                  { value: '365', label: t('1 saal') },
                ]}
              />
            </div>
            {/* Chart ke sar pe wahi arsa likha jaye jo abhi chuna hua hai */}
            <TrendChart data={d.trend} height={200} title={t('Pichhle {arsa}', { arsa: arsaKaNaam(days) })} />
            {can('expenses:create') && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <Button size="sm" variant="secondary" icon={Coins} onClick={() => setExpenseOpen(true)}>
                  {t('Kharch likhein')}
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Jinke paas chart nahi hai unke liye bhi kharch ka button rehna chahiye */}
        {!d.trend && can('expenses:create') && (
          <Card className="lg:col-span-2">
            <CardHeader title={t('Kharch')} subtitle={t('Chai, petrol, kiraya — jo bhi aaj gaya')} />
            <Button size="sm" variant="secondary" icon={Coins} onClick={() => setExpenseOpen(true)}>
              {t('Kharch likhein')}
            </Button>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {d.orders && (
          <Card>
            <CardHeader title={t('Orders')}
              action={<Button size="sm" variant="ghost" onClick={() => navigate('/orders')}>{t('Sab')}</Button>} />
            <div className="space-y-2.5">
              <OrderLine label={t('Naye')} value={d.orders.new} tone="blue" />
              <OrderLine label={t('Pack ho rahe')} value={d.orders.packed} tone="amber" />
              <OrderLine label={t('Tayyar hain')} value={d.orders.ready} tone="brand" />
              <OrderLine label={t('De diye')} value={d.orders.delivered} tone="green" />
            </div>
          </Card>
          )}

          {d.stock && (
          <Card>
            <CardHeader title={t('Stock')}
              action={<Button size="sm" variant="ghost" onClick={() => navigate('/items')}>{t('Items')}</Button>} />
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">{t('Kul item')}</dt>
                <dd className="font-medium text-slate-900">{d.stock.items}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t('Stock ki keemat')}</dt>
                <dd className="tabular font-medium text-slate-900">{formatMoney(d.stock.value)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t('Kam bache')}</dt>
                <dd className={cn('font-medium', d.stock.low ? 'text-amber-700' : 'text-slate-900')}>{d.stock.low}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t('Khatam')}</dt>
                <dd className={cn('font-medium', d.stock.outOfStock ? 'text-red-600' : 'text-slate-900')}>{d.stock.outOfStock}</dd></div>
            </dl>
          </Card>
          )}
        </div>
      </div>

      {/* ---- Kam stock ---- */}
      {d.stock?.lowItems?.length > 0 && (
        <Card className="mb-4 border-amber-200">
          <CardHeader title={t('Ye khatam hone wale hain')} subtitle={t('Supplier ko phone kar dijiye')}
            action={<Button size="sm" variant="secondary" icon={Truck}
              onClick={() => navigate('/purchases/new')}>{t('Purchase')}</Button>} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.stock.lowItems.map((i) => (
              <div key={i._id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  i.stockQty <= 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700')}>
                  {i.stockQty <= 0 ? <CircleAlert size={15} /> : <Package size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{i.name}</p>
                  <p className="text-xs text-slate-500">
                    {i.stockQty <= 0 ? t('Khatam') : `${formatQty(i.stockQty, i.unit)} ${t('bacha')}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Top items / retailers / activity ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {d.topItems && (
        <Card>
          <CardHeader title={t('Sabse zyada bike')} subtitle={t('Is mahine')} />
          {!d.topItems.length ? <Empty text={t('Abhi koi sale nahi')} /> : (
            <ol className="space-y-3">
              {d.topItems.map((row, i) => (
                <li key={row._id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{formatQty(row.qty, row.unit)}</p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium text-slate-900">
                    {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        )}

        {d.topRetailers && (
        <Card>
          <CardHeader title={t('Top retailers')} subtitle={t('Is mahine')} />
          {!d.topRetailers.length ? <Empty text={t('Abhi koi bill nahi')} /> : (
            <ol className="space-y-3">
              {d.topRetailers.map((row, i) => (
                <li key={row._id}>
                  <button onClick={() => navigate(`/retailers/${row._id}?tab=khata`)}
                    className="flex w-full items-center gap-3 text-left">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.bills} {t('bill')}</p>
                    </div>
                    <span className="tabular shrink-0 text-sm font-medium text-slate-900">
                      {formatMoney(row.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>
        )}

        <Card>
          <CardHeader title={t('Abhi abhi kya hua')} />
          {!d.activity?.length ? <Empty text={t('Kuch nahi hua abhi tak')} /> : (
            <ul className="space-y-3">
              {d.activity?.map((a, i) => {
                const Icon = ACTIVITY_ICON[a.type] || FileText;
                return (
                  <li key={i}>
                    <button onClick={() => navigate(a.link)}
                      className="flex w-full items-start gap-3 text-left">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-900">{a.title}</p>
                        <p className="truncate text-xs text-slate-500">{a.subtitle}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(a.at)}</p>
                      </div>
                      <span className={cn('tabular shrink-0 text-sm font-medium',
                        a.type === 'payment' && a.direction === 'IN' ? 'text-emerald-700' : 'text-slate-900')}>
                        {formatMoney(a.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ---- Jaldi wale kaam ---- */}
      <div className="mt-4 flex flex-wrap gap-2">
        {can('invoices') && <Button icon={Plus} onClick={() => navigate('/sale/new')}>{t('Naya bill')}</Button>}
        {can('purchases') && (
          <Button variant="secondary" icon={Truck} onClick={() => navigate('/purchases/new')}>{t('Purchase')}</Button>
        )}
        {can('khata') && (
          <Button variant="secondary" icon={Wallet} onClick={() => navigate('/payments')}>{t('Paisa entry')}</Button>
        )}
        {can('items') && (
          <Button variant="secondary" icon={Package} onClick={() => navigate('/items')}>{t('Items')}</Button>
        )}
      </div>

      <ExpenseFormModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        categories={categories}
        onSaved={() => bust('expenses', 'dashboard', 'reports')}
      />
    </>
  );
}

/**
 * Chhota tile — phone pe do ek line me.
 *
 * `StatCard` se alag isliye rakha ki wo list wale page ke liye bana hai (chaar
 * tile, upar ek patti). Yahan chhah aane hain, isliye padding kam, icon chhota
 * aur number ek naap chhota — warna 390px ke phone pe "₹1,24,500" kat jata hai.
 */
function Tile({ label, value, sub, icon: Icon, tone = 'brand', change, onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700',
  };
  return (
    <Card padding={false} className="transition-colors hover:border-brand-300" onClick={onClick}>
      <div className="p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-xs leading-snug text-slate-500">{label}</p>
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', tones[tone])}>
            <Icon size={13} />
          </span>
        </div>
        <p className="tabular mt-1 truncate text-lg font-semibold text-slate-900">{value}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {change !== undefined && change !== null && (
            <span className={cn('flex shrink-0 items-center gap-0.5 text-[11px] font-medium',
              change >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(change)}%
            </span>
          )}
          {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function OrderLine({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-slate-600">
        <Badge tone={tone}>{value}</Badge> {label}
      </span>
    </div>
  );
}

const Empty = ({ text }) => <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
