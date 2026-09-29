import type { AppConfig, LabelPreset, LabelProps } from "$/types";

export const configureFabric = () => {
  // Kept as a compatibility entry point while the editor migrates to Konva.
};

/** Default presets for LabelPropsEditor */
export const DEFAULT_LABEL_PRESETS: LabelPreset[] = [
  { width: 40, height: 12, unit: "mm", dpmm: 8, printDirection: "left", shape: "rect" },
  { width: 50, height: 30, unit: "mm", dpmm: 8, printDirection: "top", shape: "rect" },
  { width: 40, height: 12, unit: "mm", dpmm: 11.81, printDirection: "left", shape: "rect", title: "40x12mm 300dpi" },
  { width: 50, height: 30, unit: "mm", dpmm: 11.81, printDirection: "top", shape: "rect", title: "50x30mm 300dpi" },
];

export const DEFAULT_LABEL_PROPS: LabelProps = {
  printDirection: "left",
  size: { width: 240, height: 96 },
};

export const GRID_SIZE = 5;

export const OBJECT_SIZE_DEFAULTS = {
  width: 64,
  height: 64,
};

export const OBJECT_DEFAULTS = {
  snapAngle: 10,
  top: 10,
  left: 10,
  originX: "left" as const,
  originY: "top" as const,
};

export const OBJECT_DEFAULTS_VECTOR = {
  ...OBJECT_DEFAULTS,
  fill: "transparent",
  stroke: "black",
  strokeWidth: 3,
};

export const OBJECT_DEFAULTS_TEXT = {
  ...OBJECT_DEFAULTS,
  fill: "black",
  fontFamily: "Noto Sans Variable",
  textAlign: "center" as const,
  originX: "center" as const,
  originY: "center" as const,
  lineHeight: 1,
};

export const THUMBNAIL_HEIGHT = 48;
export const THUMBNAIL_QUALITY = 0.7;

export const APP_CONFIG_DEFAULTS: AppConfig = {
  fitMode: "stretch",
  iconListMode: "both",
  gridEnabled: false,
};

export const CSV_DEFAULT = "var1,var2\n123,456\n777,888";
