import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { Card, CardHeader, Button } from '@/components/ui';
import InviteCard from '../parties/InviteCard';
import { t } from '@/lib/i18n';

export default function RetailersTab() {
  return (
    <div className="space-y-5">
      <InviteCard />

      <Card>
        <CardHeader
          title={t('Retailers ka poora management')}
          subtitle={t('List, approve/block, party-wise rate aur khata — sab Retailers page pe')}
        />
        <Link to="/retailers">
          <Button variant="secondary" icon={Users}>
            {t('Retailers page kholein')} <ArrowRight size={15} />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
