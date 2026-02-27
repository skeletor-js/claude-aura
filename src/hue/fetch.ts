import { Agent } from "undici";

const hueAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

export async function hueFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    // @ts-expect-error dispatcher is valid in Node/undici
    dispatcher: hueAgent,
  });
}
