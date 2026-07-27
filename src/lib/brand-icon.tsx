import { ImageResponse } from "next/og";
import { BRAND } from "./brand";

interface BrandIconOptions {
  size: number;
  fontSize: number;
  borderRadius: string;
  background?: string;
}

export function renderBrandIcon({
  size,
  fontSize,
  borderRadius,
  background = BRAND.colors.bg,
}: BrandIconOptions) {
  return new ImageResponse(
    <div
      style={{
        fontSize,
        background,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: BRAND.colors.text,
        borderRadius,
        fontWeight: 700,
      }}
    >
      {BRAND.name[0]}
    </div>,
    { width: size, height: size },
  );
}
