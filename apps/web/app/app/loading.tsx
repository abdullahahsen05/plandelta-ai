export default function ApplicationLoading() {
  return (
    <main aria-busy="true" aria-label="Loading workspace" className="app-page">
      <div className="loading-line w-28" />
      <div className="loading-line mt-6 h-10 max-w-lg" />
      <div className="loading-line mt-3 max-w-2xl" />
      <div className="mt-12 grid gap-px border border-[#D8D4CA] bg-[#D8D4CA] md:grid-cols-3">
        <div className="loading-block" />
        <div className="loading-block" />
        <div className="loading-block" />
      </div>
      <span className="sr-only">Loading PlanDelta workspace</span>
    </main>
  );
}
