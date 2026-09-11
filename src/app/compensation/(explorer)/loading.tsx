export default function CompensationLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="skeleton h-8 w-72" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full" />
      <div className="mt-6 flex gap-6">
        <div className="skeleton hidden h-96 w-72 lg:block" />
        <div className="flex-1 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
