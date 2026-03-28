import Sidebar from "@/components/Sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--app-bg)]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="h-screen flex-1 overflow-y-auto bg-[var(--app-bg)] p-8">
        {children}
      </main>
    </div>
  );
}
