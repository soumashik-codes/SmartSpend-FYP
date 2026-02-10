export default function ReceiptsPage() {
  return (
    <section className="p-8">
      <h1 className="text-3xl font-semibold text-gray-900">
        Receipt Analysis
      </h1>

      <p className="mt-2 text-gray-600">
        Upload and analyse receipts to extract item-level spending data.
      </p>

      <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">
          Receipt upload and OCR analysis will appear here.
        </p>
      </div>
    </section>
  );
}
