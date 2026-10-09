/* eslint-disable @next/next/no-img-element */
export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const style = { width: size, height: size };
  if (src) {
    return <img src={src} alt="" style={style} className="rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.42 }}
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#7c1230] font-semibold text-white"
    >
      {initial}
    </span>
  );
}
