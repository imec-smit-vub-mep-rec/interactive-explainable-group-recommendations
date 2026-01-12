import { isAdminAuthenticated } from "@/lib/admin-auth";
import LoginForm from "./LoginForm";

export default async function ProtectedAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
