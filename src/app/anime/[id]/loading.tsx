export default function Loading() {
  return (
    <div>
      <div className="skeleton -mt-[var(--nav-h)] h-[46vh] min-h-[300px] max-h-[520px] w-full" />
      <div className="relative mx-auto -mt-44 flex max-w-[1600px] gap-10 px-4 md:-mt-56 md:px-8">
        <div className="skeleton aspect-[2/3] w-36 shrink-0 rounded-xl sm:w-44 md:w-60" />
        <div className="flex-1 space-y-4 pt-24">
          <div className="skeleton h-10 w-2/3 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-12 w-64 rounded-full" />
          <div className="skeleton h-20 w-full max-w-3xl rounded" />
        </div>
      </div>
    </div>
  );
}
