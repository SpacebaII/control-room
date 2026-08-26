const OWNER_COOKIE = "control_room_owner";
const OAUTH_COOKIE = "control_room_oauth_state";
const OWNER_AGE_SECONDS = 8 * 60 * 60;

interface OwnerSession { login: string; expiresAt: number }

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function cookies(request: Request) {
  return new Map((request.headers.get("Cookie") ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index), part.slice(index + 1)];
  }));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function equal(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function ownerCookie(login: string, secret: string, secure: boolean) {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ login, expiresAt: Date.now() + OWNER_AGE_SECONDS * 1000 } satisfies OwnerSession)));
  return `${OWNER_COOKIE}=${payload}.${await hmac(payload, secret)}; Path=/; Max-Age=${OWNER_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export async function readOwner(request: Request, env: Env): Promise<OwnerSession | null> {
  const raw = cookies(request).get(OWNER_COOKIE);
  if (!raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = raw.slice(0, separator);
  const supplied = raw.slice(separator + 1);
  if (!equal(await hmac(payload, env.SESSION_SIGNING_SECRET), supplied)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replaceAll("-", "+").replaceAll("_", "/")), (character) => character.charCodeAt(0)))) as OwnerSession;
    return session.expiresAt > Date.now() && session.login.toLowerCase() === env.GITHUB_ALLOWED_LOGIN.toLowerCase() ? session : null;
  } catch { return null; }
}

function redirect(location: string, cookiesToSet: string[] = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const value of cookiesToSet) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

function randomVerifier() {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return base64Url(bytes);
}

async function challenge(verifier: string) {
  return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

export async function handleAuth(request: Request, url: URL, env: Env): Promise<Response> {
  const secure = url.protocol === "https:";
  if (url.pathname === "/auth/session") {
    const owner = await readOwner(request, env);
    const date = new Date().toISOString().slice(0, 10);
    const usage = owner ? await env.DB.prepare("SELECT runs, input_tokens, output_tokens FROM ai_usage WHERE github_login = ? AND usage_date = ?").bind(owner.login, date).first<{ runs: number; input_tokens: number; output_tokens: number }>() : null;
    return Response.json({ authenticated: Boolean(owner), login: owner?.login, configured: authConfigured(env), liveAvailable: Boolean(owner && env.OPENAI_API_KEY), usage: { runs: usage?.runs ?? 0, limit: 20, inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0 } }, { headers: { "Cache-Control": "no-store" } });
  }
  if (url.pathname === "/auth/github/start") {
    if (!authConfigured(env)) return Response.json({ error: { code: "AUTH_NOT_CONFIGURED", message: "GitHub owner authentication is not configured." } }, { status: 503 });
    const state = crypto.randomUUID();
    const verifier = randomVerifier();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await env.DB.prepare("INSERT INTO oauth_sessions (id, github_login, verifier_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(state, "pending", verifier, expires, new Date().toISOString()).run();
    const callback = `${url.origin}/auth/github/callback`;
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, state, code_challenge: await challenge(verifier), code_challenge_method: "S256", allow_signup: "false" }).toString();
    return redirect(authorize.toString(), [`${OAUTH_COOKIE}=${state}; Path=/auth/github/callback; Max-Age=600; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`]);
  }
  if (url.pathname === "/auth/github/callback") {
    const state = url.searchParams.get("state"); const code = url.searchParams.get("code");
    if (!state || !code || cookies(request).get(OAUTH_COOKIE) !== state) return authFailure(url.origin, "OAuth state validation failed.");
    const row = await env.DB.prepare("SELECT verifier_hash, expires_at FROM oauth_sessions WHERE id = ?").bind(state).first<{ verifier_hash: string; expires_at: string }>();
    await env.DB.prepare("DELETE FROM oauth_sessions WHERE id = ?").bind(state).run();
    if (!row || Date.parse(row.expires_at) <= Date.now()) return authFailure(url.origin, "OAuth request expired.");
    const callback = `${url.origin}/auth/github/callback`;
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "control-room-pmo" }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callback, code_verifier: row.verifier_hash }) });
    const token = await tokenResponse.json<{ access_token?: string; error_description?: string }>();
    if (!tokenResponse.ok || !token.access_token) return authFailure(url.origin, token.error_description ?? "GitHub did not issue an access token.");
    const userResponse = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token.access_token}`, "User-Agent": "control-room-pmo", "X-GitHub-Api-Version": "2022-11-28" } });
    const user = await userResponse.json<{ login?: string }>();
    if (!userResponse.ok || !user.login || user.login.toLowerCase() !== env.GITHUB_ALLOWED_LOGIN.toLowerCase()) return authFailure(url.origin, "This GitHub account is not allowed to use live owner mode.");
    return redirect(`${url.origin}/copilot?owner=1`, [await ownerCookie(user.login, env.SESSION_SIGNING_SECRET, secure), `${OAUTH_COOKIE}=; Path=/auth/github/callback; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`]);
  }
  if (url.pathname === "/auth/logout") return redirect(`${url.origin}/copilot`, [`${OWNER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`]);
  return Response.json({ error: { code: "NOT_FOUND", message: "Authentication route not found." } }, { status: 404 });
}

function authConfigured(env: Env) {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_ALLOWED_LOGIN && !env.GITHUB_CLIENT_ID.includes("placeholder") && !env.GITHUB_CLIENT_ID.includes("client-id"));
}

function authFailure(origin: string, message: string) {
  return redirect(`${origin}/copilot?auth_error=${encodeURIComponent(message)}`);
}
