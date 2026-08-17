import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { PrefsProvider } from '@/context/PrefsContext';
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
 */
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <PrefsProvider>
            <CartProvider>
              <NotificationProvider>
                <AppRoutes />
              </NotificationProvider>
            </CartProvider>
          </PrefsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
