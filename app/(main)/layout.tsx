import TopHeader from "@/components/layout/TopHeader";
import BottomNav from "@/components/layout/BottomNav";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopHeader />
      {children}
      <BottomNav />
    </>
  );
}
