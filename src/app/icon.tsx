import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab favicon — brand book mark (replaces default Vercel icon). */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 20,
            borderRadius: 3,
            background: "#ffffff",
            color: "#0f766e",
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "sans-serif",
          }}
        >
          AI
        </div>
      </div>
    ),
    { ...size },
  );
}
