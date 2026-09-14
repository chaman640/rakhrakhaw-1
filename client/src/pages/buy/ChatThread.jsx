import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { useShop } from '@/context/ShopContext';
import ChatThreadView from '@/components/chat/ChatThreadView';
import { t } from '@/lib/i18n';

/**
 * `X-Shop-Id` yahan HAR REQUEST PE ALAG SE bhejte hain — global "abhi chuni
 * hui dukaan" (ShopContext) ko chhedte nahi. Isi tarah cart page bhi karta
 * hai jab teen dukaano ka maal ek saath dikhana ho (api.js me poori wajah).
 * Isse retailer ek dukaan browse karte-karte kisi doosri dukaan ka chat khol
 * sakta hai, bina apni "abhi ki dukaan" badle.
 */
export default function ChatThread() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { selectShop } = useShop();

  function openRef(type, refId) {
    if (type === 'order') {
      navigate(`/my-orders/${refId}`);
    } else if (type === 'item') {
      // Item ki apni dukaan hi "abhi ki dukaan" ban jaye, warna galat
      // dukaan ke catalog me item dhoondha jaata
      selectShop(businessId);
      navigate(`/shop/item/${refId}`);
    }
  }

  return (
    <ChatThreadView
      myRole="retailer"
      contactName={state?.name || t('Dukaan')}
      contactAvatar={state?.logoUrl}
      onBack={() => navigate('/buy/chat')}
      onOpenRef={openRef}
      onOpenContact={() => { selectShop(businessId); navigate('/shop'); }}
      fetchMessages={() => api.get('/my/chat/messages', {
        headers: { 'X-Shop-Id': businessId },
      }).then((r) => r.data)}
      postMessage={async (formData) => {
        const res = await api.post('/my/chat/messages', formData, {
          headers: { 'X-Shop-Id': businessId },
        });
        bust('my-chat-conversations');
        return res;
      }}
    />
  );
}
