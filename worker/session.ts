const COOKIE_NAME = "control_room_demo";
const MAX_AGE = 24 * 60 * 60;

function toBase64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("Cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function readWorkspaceCookie(request: Request, secret: string) {
  const raw = cookieValue(request, COOKIE_NAME);
  if (!raw) return null;
  const [id, supplied] = raw.split(".");
  if (!id || !supplied) return null;
  const expected = await signature(id, secret);
  const left = new TextEncoder().encode(expected);
  const right = new TextEncoder().encode(supplied);
  if (left.length !== right.length) return null;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0 ? id : null;
}

export async function createWorkspaceCookie(id: string, secret: string, secure: boolean) {
  const signed = await signature(id, secret);
  return `${COOKIE_NAME}=${id}.${signed}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function currentActor(request: Request) {
  const actor = request.headers.get("X-Control-Room-Actor")?.trim();
  return actor && /^[a-z][a-z0-9_-]{1,30}$/.test(actor) ? actor : "alex";
}
