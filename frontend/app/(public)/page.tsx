export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-bold mb-4">
        Master Your Money with SmartSpend
      </h1>

      <p className="max-w-xl text-gray-600 mb-6">
        Track expenses, gain AI-driven insights, and forecast your financial future.
      </p>

      <a
        href="/login"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Log In
      </a>
    </main>
  );
}
