import type { CieXY } from "../types.js";
import { hueFetch } from "./fetch.js";

export async function setLightColor(
  bridgeIp: string,
  username: string,
  lightId: number,
  xy: CieXY,
  brightness: number,
  transitionMs: number
): Promise<void> {
  const bri = Math.max(1, Math.min(254, Math.round((brightness / 100) * 254)));
  const transitiontime = Math.round(transitionMs / 100);

  const res = await hueFetch(
    `https://${bridgeIp}/api/${username}/lights/${lightId}/state`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: true, xy: [xy.x, xy.y], bri, transitiontime }),
    }
  );
  const data = await res.json();
  if (Array.isArray(data)) {
    const errors = data.filter(
      (r: Record<string, unknown>) => r.error !== undefined
    );
    if (errors.length > 0) {
      throw new Error(`Hue API error: ${JSON.stringify(errors[0])}`);
    }
  }
}

export async function turnOffLight(
  bridgeIp: string,
  username: string,
  lightId: number,
  transitionMs: number
): Promise<void> {
  const transitiontime = Math.round(transitionMs / 100);
  await hueFetch(
    `https://${bridgeIp}/api/${username}/lights/${lightId}/state`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: false, transitiontime }),
    }
  );
}

export async function flashLight(
  bridgeIp: string,
  username: string,
  lightId: number
): Promise<void> {
  await hueFetch(
    `https://${bridgeIp}/api/${username}/lights/${lightId}/state`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert: "select" }),
    }
  );
}
