type MetricCardProps = {
  title: string;
  value: string;
  positive?: boolean;
};

export default function MetricCard({
  title,
  value,
  positive = true,
}: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <p className="text-sm text-gray-500">{title}</p>

      <p
        className={`mt-2 text-2xl font-semibold ${
          positive ? "text-green-700" : "text-red-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
