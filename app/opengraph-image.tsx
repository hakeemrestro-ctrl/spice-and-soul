import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Spice & Soul Academy by Hakeem's";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2a1a08 0%, #3e2c19 60%, #5a3e22 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Warm glow */}
        <div
          style={{
            position: "absolute",
            top: -80,
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(242,155,31,0.25) 0%, transparent 70%)",
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 18,
            letterSpacing: "0.28em",
            color: "#f29b1f",
            marginBottom: 24,
            textTransform: "uppercase",
          }}
        >
          BY HAKEEM&apos;S · INDORE
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: "serif",
            fontSize: 80,
            fontWeight: 400,
            color: "#fdf6ee",
            lineHeight: 1.05,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Spice &amp; Soul
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 22,
            letterSpacing: "0.3em",
            color: "#c9a97a",
            marginBottom: 40,
            textTransform: "uppercase",
          }}
        >
          ACADEMY
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: "serif",
            fontStyle: "italic",
            fontSize: 28,
            color: "#c9a97a",
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          Master authentic Indian cooking · 5 courses · 114 recipes
        </div>
      </div>
    ),
    size,
  );
}
