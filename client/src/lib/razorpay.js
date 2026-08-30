/**
 * Razorpay ka checkout — script zarurat padne par hi load hoti hai.
 *
 * `index.html` me daal dete to har aadmi ke phone pe har baar ~100 KB extra
 * jata, jabki plan mahine me ek baar liya jata hai. Hamare dukaandaar aksar
 * 2G/3G pe hote hain.
 */
const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading = null;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;

  loading = new Promise((resolve) => {
    const el = document.createElement('script');
    el.src = SRC;
    el.async = true;
    el.onload = () => resolve(true);
    el.onerror = () => { loading = null; resolve(false); };
    document.body.appendChild(el);
  });
  return loading;
}

/**
 * Checkout kholo aur jawab wapas do.
 *
 * `modal.ondismiss` zaroori hai — bina uske aadmi parda band kar de to vaada
 * (promise) kabhi poora hi nahi hota, aur button hamesha ke liye "ruko" pe
 * atka reh jata hai.
 */
export function openCheckout({ order, business, user, onSuccess, onDismiss, onFail }) {
  const rzp = new window.Razorpay({
    key: order.keyId,
    amount: order.amountPaise,
    currency: order.currency || 'INR',
    order_id: order.orderId,
    name: 'Rakh Rakhav',
    description: `${order.planName} — ${order.months} mahina`,
    prefill: {
      name: user?.name || '',
      contact: user?.phone || '',
      email: business?.email || '',
    },
    theme: { color: '#0f766e' },
    modal: { ondismiss: () => onDismiss?.() },
    handler: (res) => onSuccess?.({
      orderId: res.razorpay_order_id,
      paymentId: res.razorpay_payment_id,
      signature: res.razorpay_signature,
    }),
  });

  rzp.on('payment.failed', (res) => onFail?.(res?.error?.description || ''));
  rzp.open();
}

/**
 * AUTOPAY KA CHECKOUT — mandate ke liye.
 *
 * Ek baar ke payment se do farq hain, aur dono zaroori hain:
 *
 *   1. `subscription_id` jata hai, `order_id` nahi.
 *   2. Jawab me `razorpay_subscription_id` aata hai, aur signature bhi
 *      doosre kram se banta hai — server usi hisaab se jaanchta hai.
 *
 * Grahak ko yahan ek "manzoori" (mandate) deni hoti hai — yaani wo apne bank
 * ko kehta hai ki har mahine itna paisa katne dena. Isliye niche saaf likha
 * jata hai ki kitna aur kab katega.
 */
export function openAutopay({ sub, business, user, onSuccess, onDismiss, onFail }) {
  const rzp = new window.Razorpay({
    key: sub.keyId,
    subscription_id: sub.subscriptionId,
    name: 'Rakh Rakhav',
    description: `${sub.planName} — har mahine ₹${sub.amountRupees}`,
    prefill: {
      name: user?.name || '',
      contact: user?.phone || '',
      email: business?.email || '',
    },
    theme: { color: '#0f766e' },
    modal: { ondismiss: () => onDismiss?.() },
    handler: (res) => onSuccess?.({
      subscriptionId: res.razorpay_subscription_id,
      paymentId: res.razorpay_payment_id,
      signature: res.razorpay_signature,
    }),
  });

  rzp.on('payment.failed', (res) => onFail?.(res?.error?.description || ''));
  rzp.open();
}
