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
