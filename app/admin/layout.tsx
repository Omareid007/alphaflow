import { AdminSidebar } from "@/components/layout/admin-sidebar";

export const metadata = {
  title: "Admin Hub - AlphaFlow",
  description: "Admin control plane for AlphaFlow trading platform",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 pl-64">
        <div className="min-h-screen p-6">{children}</div>
      </main>
    </div>
  );
}
