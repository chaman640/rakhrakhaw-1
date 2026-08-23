import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { PrefsProvider } from '@/context/PrefsContext';
import { ShopProvider } from '@/context/ShopContext';
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ToastProvider } from '@/components/ui/Toast';
import AppRoutes from '@/routes/AppRoutes';

/**
 * PrefsProvider AuthProvider ke ANDAR hai — bahar nahi.
 *
 * Bhasha badalne par PrefsProvider apne neeche ka poora hissa dobara banata
 * hai. Agar wo sabse bahar hota to login bhi dobara ban jata aur ek pal ke
 * liye "loading" dikh kar session dobara check hota. Andar rakhne se login
 * jaisa ka waisa rehta hai aur sirf dikhne wala hissa nayi bhasha me aata hai.
 *
 * ShopProvider CartProvider ke UPAR hai — kyunki cart ab "kis dukaan ka cart"
 * ka jawab uski se leta hai. Ulta rakhne par cart ko pata hi nahi chalta ki
 * dukaan badal gayi, aur wo purani dukaan ka number dikhata rehta.
 */
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <PrefsProvider>
            <ShopProvider>
              <CartProvider>
                <NotificationProvider>
                  <AppRoutes />
                </NotificationProvider>
              </CartProvider>
            </ShopProvider>
          </PrefsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
