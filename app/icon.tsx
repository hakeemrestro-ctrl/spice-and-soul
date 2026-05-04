import { ImageResponse } from "next/og";

// Spice & Soul heritage favicon — clove-brown ground, cream "H" monogram,
// saffron accent dot (echoes the recipe PDF aesthetic).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <span
          style={{
            fontFamily: "serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 26,
            color: "#fdfaf3",
            lineHeight: 1,
            transform: "translateY(-1px)",
          }}
        >
          H
        </span>
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 5,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#f29b1f",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
