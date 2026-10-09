import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const tri = size * 0.36;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff4766, #b3123a)",
        }}
      >
        <svg width={tri} height={tri} viewBox="0 0 10 10" style={{ marginLeft: size * 0.05 }}>
          <path d="M1 0.5v9l8-4.5z" fill="#fff" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
