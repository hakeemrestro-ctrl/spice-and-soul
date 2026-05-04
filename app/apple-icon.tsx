import { ImageResponse } from "next/og";

// Apple home-screen icon — same heritage H mark scaled to 180×180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#281a0d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 36,
        }}
      >
        <span
          style={{
            fontFamily: "serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 138,
            color: "#fdfaf3",
            lineHeight: 1,
            transform: "translateY(-6px)",
          }}
        >
          H
        </span>
        <span
          style={{
            position: "absolute",
            top: 22,
            right: 28,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "#f29b1f",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
