// Sample staff used by the Demo page and by "Add demo workers to the app".
export const DEMO_DOMAIN = "example.com";
export const DEMO_PREFIX = "DEMO · ";

export type DemoStatus = "available" | "partial" | "unavailable" | null;
export interface DemoWorker { slug: string; name: string; position: string; also: string[]; rate: number; client: number; personal?: number; phone: string; languages: string[] }

export const DEMO_WORKERS: DemoWorker[] = [
  { slug: "demo.alice.chan", name: "Alice Chan", position: "Server", also: ["Bartender"], rate: 120, client: 180, phone: "+852 9123 0001", languages: ["English", "Cantonese"] },
  { slug: "demo.ben.wong", name: "Ben Wong", position: "Server", also: [], rate: 120, client: 180, phone: "+852 9123 0002", languages: ["Cantonese", "Mandarin"] },
  { slug: "demo.carmen.li", name: "Carmen Li", position: "Server", also: [], rate: 120, client: 180, personal: 130, phone: "+852 9123 0003", languages: ["English", "Mandarin"] },
  { slug: "demo.daniel.ho", name: "Daniel Ho", position: "Bartender", also: ["Server"], rate: 150, client: 220, phone: "+852 9123 0004", languages: ["English", "Cantonese"] },
  { slug: "demo.elena.rossi", name: "Elena Rossi", position: "Bartender", also: [], rate: 150, client: 220, personal: 160, phone: "+852 9123 0005", languages: ["English", "Italian"] },
  { slug: "demo.felix.tam", name: "Felix Tam", position: "Chef", also: [], rate: 220, client: 350, phone: "+852 9123 0006", languages: ["English", "Cantonese"] },
  { slug: "demo.grace.lau", name: "Grace Lau", position: "Chef", also: ["Kitchen Porter"], rate: 220, client: 350, phone: "+852 9123 0007", languages: ["English"] },
  { slug: "demo.hugo.martin", name: "Hugo Martin", position: "Event Manager", also: ["Server"], rate: 250, client: 400, phone: "+852 9123 0008", languages: ["English", "French"] },
  { slug: "demo.ivy.ng", name: "Ivy Ng", position: "Server", also: [], rate: 120, client: 180, phone: "+852 9123 0009", languages: ["Cantonese"] },
  { slug: "demo.jason.yip", name: "Jason Yip", position: "Kitchen Porter", also: [], rate: 90, client: 140, phone: "+852 9123 0010", languages: ["Cantonese"] },
];

/** Repeatable sample availability per worker and day. */
export function demoAvail(slug: string, day: string): { status: DemoStatus; from?: string; to?: string } {
  let h = 0;
  for (const c of slug + day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = h % 10;
  if (r < 5) return { status: "available" };
  if (r < 7) return { status: "partial", from: r === 5 ? "17:00" : "12:00", to: r === 5 ? "23:59" : "18:00" };
  if (r < 9) return { status: "unavailable" };
  return { status: null };
}
