import ProtectedAdmin from '@/components/admin/ProtectedAdmin';
import PreviewContent from '@/components/admin/PreviewContent';

export default function PreviewPage() {
  return (
    <ProtectedAdmin>
      <PreviewContent />
    </ProtectedAdmin>
  );
}
