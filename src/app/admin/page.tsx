import ProtectedAdmin from "@/components/admin/ProtectedAdmin";
import AdminContent from "@/components/admin/AdminContent";

export default function AdminPage() {
  return (
    <ProtectedAdmin>
      <AdminContent />
    </ProtectedAdmin>
  );
}
