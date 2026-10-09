import Svg, { Circle, Path } from "react-native-svg";

export type LogoMarkProps = {
  /** Pixel size of the (square) mark. @default 64 */
  size?: number;
};

/**
 * RouteZen brand mark: a route line resolving into a destination pin over a
 * leaf, inside a deep forest-green badge — the "smarter routes, greener
 * tomorrow" idea in one glyph. Colors come from `tailwind.config.js` brand
 * tokens (kept literal here since react-native-svg fill/stroke props don't
 * take NativeWind classes).
 */
export function LogoMark({ size = 64 }: LogoMarkProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessible
      accessibilityLabel="RouteZen logo mark"
      accessibilityRole="image"
    >
      <Circle cx={32} cy={32} r={32} fill="#0E4429" />
      <Path
        d="M15 45c3-5 3-10 8-13s7-3 9-8 7-10 12-13"
        stroke="#F4C430"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={44} cy={11} r={5.5} fill="#F4C430" />
      <Circle cx={44} cy={11} r={2.2} fill="#0E4429" />
      <Path
        d="M12 44c-2.5 4-1.5 9 2.5 11s9.5-0.5 9.5-5c0-3.5-2.5-5.5-6-6.5-3.5-1-4.5-1-6 0.5z"
        fill="#1B6B3F"
      />
    </Svg>
  );
}
