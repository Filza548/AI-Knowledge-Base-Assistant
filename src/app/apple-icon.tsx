import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 110,
            height: 110,
            borderRadius: 24,
            background: "#ffffff",
            color: "#0f766e",
            fontSize: 42,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: -1,
          }}
        >
          AI
          <div
            style={{
              marginTop: 6,
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#f59e0b",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
