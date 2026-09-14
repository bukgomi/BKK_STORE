import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomTabBar from "@/components/BottomTabBar";
import WishlistInitializer from "@/components/WishlistInitializer";
import QuickSidebar from "@/components/QuickSidebar";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <WishlistInitializer />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomTabBar />
      <QuickSidebar />
    </div>
  );
}
