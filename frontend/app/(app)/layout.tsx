import Sidebar from "@/components/Sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#0b1220]">

      {/* Sidebar - Fixed */}
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] p-8">
        {children}
      </main>

    </div>
  );
}
