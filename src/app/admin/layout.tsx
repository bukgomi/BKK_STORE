import { requireAdmin } from "@/lib/admin-guard";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata = { title: "관리자 - 탑캐스팅" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const user = { name: session.user?.name, email: session.user?.email };

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-800">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 pl-16 lg:pl-6">
          <div className="text-sm text-gray-500 truncate">
            관리자 모드
          </div>
          <div className="text-sm text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
