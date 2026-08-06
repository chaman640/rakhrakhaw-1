import { Hammer } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';

// Part 1 me sirf shell hai. Har feature page apne part me isko replace karega.
export default function ComingSoon({ title, part, description }) {
  return (
    <>
      <PageHeader title={title} subtitle={description} />
      <Card className="flex flex-col items-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Hammer size={22} />
        </div>
        <p className="text-sm font-medium text-slate-900">Ye page Part {part} me banega</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Abhi sirf layout aur database schema tayyar hai (Part 1).
        </p>
      </Card>
    </>
  );
}
