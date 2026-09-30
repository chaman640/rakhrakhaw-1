import Spinner from '@/components/ui/Spinner';

// Shown while a lazily loaded page is downloading
export default function PageFallback() {
  return (
    <div className="flex justify-center py-16">
      <Spinner size={28} />
    </div>
  );
}
