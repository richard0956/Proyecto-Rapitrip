import { BottomNav } from "@/components/bottom-nav";
import { requireCourier } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireCourier();
  return (
    <>
      <div className="mx-auto min-h-dvh w-full max-w-[640px] pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">{children}</div>
      <BottomNav />
    </>
  );
}
