import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import ChatThreadView from '@/components/chat/ChatThreadView';
import { t } from '@/lib/i18n';

export default function ChatThread() {
  const { partyId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();

  function openRef(type, refId) {
    if (type === 'order') navigate(`/orders/${refId}`);
    else if (type === 'item') navigate('/items');
  }

  return (
    <ChatThreadView
      myRole="wholesaler"
      contactName={state?.name || t('Retailer')}
      onBack={() => navigate('/chat')}
      onOpenRef={openRef}
      onOpenContact={() => navigate(`/retailers/${partyId}?tab=orders`)}
      fetchMessages={() => api.get(`/chat/${partyId}/messages`).then((r) => r.data)}
      postMessage={async (formData) => {
        const res = await api.post(`/chat/${partyId}/messages`, formData);
        bust('chat-conversations');
        return res;
      }}
    />
  );
}
