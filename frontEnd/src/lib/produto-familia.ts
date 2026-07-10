import pacoca from "@/assets/pacoca.jpg";
import biriba from "@/assets/biriba.jpg";
import fondant from "@/assets/fondant.jpg";

export type FamiliaKey = "pacoca" | "biriba" | "fondant";

export const FAMILIAS: { key: FamiliaKey; nome: string; img: string }[] = [
  { key: "pacoca", nome: "Paçoca Caseira", img: pacoca },
  { key: "biriba", nome: "Biriba", img: biriba },
  { key: "fondant", nome: "Fondant de leite", img: fondant },
];

export function detectarFamilia(nome: string | undefined | null): FamiliaKey | null {
  if (!nome) return null;
  const n = nome.toLowerCase();
  if (n.includes("paçoca") || n.includes("pacoca")) return "pacoca";
  if (n.includes("fondant")) return "fondant";
  if (n.includes("biriba")) return "biriba";
  return null;
}

export function imgFamilia(key: FamiliaKey): string {
  return FAMILIAS.find((f) => f.key === key)!.img;
}
