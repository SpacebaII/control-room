import { riskExposure } from "../domain/health";
import type { Actor } from "../domain/model";

export function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
export function shortDate(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
export function actorName(actors: Actor[], id: string) { return actors.find((actor) => actor.id === id)?.name ?? id; }
export function exposureLabel(probability: number, impact: number) { const score = riskExposure(probability, impact); return `${score}/25`; }
