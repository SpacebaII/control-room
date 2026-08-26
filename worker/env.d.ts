export {};

declare global {
  interface Env {
    SESSION_SIGNING_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GITHUB_ALLOWED_LOGIN: string;
    OPENAI_API_KEY: string;
  }
}
