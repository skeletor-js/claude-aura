export interface CieXY {
  x: number;
  y: number;
}

export type AuraState = "idle" | "thinking" | "needs_input";

export interface StateColor {
  hex: string;
  xy: CieXY;
  brightness: number;
}

export interface BridgeConfig {
  ip: string;
  username: string;
}

export interface LightConfig {
  id: number;
  name: string;
}

export interface ColorsConfig {
  idle: string;
  thinking: string;
  needs_input: string;
}

export interface AuraConfig {
  bridge: BridgeConfig;
  light: LightConfig;
  colors: ColorsConfig;
  brightness: number;
  transitionMs: number;
  port: number;
}
