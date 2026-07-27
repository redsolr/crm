import { renderBrandIcon } from "@/lib/brand-icon";
import { BRAND } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderBrandIcon({
    size: 180,
    fontSize: 120,
    borderRadius: "22%",
    background: `linear-gradient(135deg, ${BRAND.colors.bg} 0%, ${BRAND.colors.bgDeep} 100%)`,
  });
}
