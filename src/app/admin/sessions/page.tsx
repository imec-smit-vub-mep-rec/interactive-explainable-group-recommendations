import ProtectedAdmin from "@/components/admin/ProtectedAdmin";
import SessionsDashboard from "@/components/admin/SessionsDashboard";

export default function AdminSessionsPage() {
  return (
    <ProtectedAdmin>
      <SessionsDashboard />
    </ProtectedAdmin>
  );
}
