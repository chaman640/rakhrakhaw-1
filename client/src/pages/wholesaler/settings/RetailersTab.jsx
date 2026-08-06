import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { Card, CardHeader, Button } from '@/components/ui';
import InviteCard from '../parties/InviteCard';

export default function RetailersTab() {
  return (
    <div className="space-y-5">
      <InviteCard />

      <Card>
        <CardHeader
          title="Retailers ka poora management"
          subtitle="List, approve/block, party-wise rate aur khata — sab Retailers page pe"
        />
        <Link to="/retailers">
          <Button variant="secondary" icon={Users}>
            Retailers page kholein <ArrowRight size={15} />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
