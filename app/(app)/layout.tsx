import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { demoMode } from "@/lib/config";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <AppShell userEmail={user.email} demo={demoMode}>
      {children}
    </AppShell>
  );
}
