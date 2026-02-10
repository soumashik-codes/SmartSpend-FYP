export default function InsightsPage() {
  return (
    <section className="p-8">
      <h1 className="text-3xl font-semibold text-gray-900">
        SmartSpend Advisor
      </h1>

      <p className="mt-2 text-gray-600">
        Personalized financial insights and observations based on your spending.
      </p>

      {/* Placeholder content */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <p className="font-medium text-red-600">Alert</p>
          <p className="mt-2 text-gray-700">
            Spending on Shopping is higher than usual this month.
          </p>
        </div>

        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <p className="font-medium text-green-600">Positive</p>
          <p className="mt-2 text-gray-700">
            Transport costs have decreased compared to last month.
          </p>
        </div>
      </div>
    </section>
  );
}
