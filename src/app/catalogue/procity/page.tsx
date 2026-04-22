import { redirect } from "next/navigation"

/**
 * Ancienne URL plate du catalogue Procity (liste sans hiérarchie) remplacée par
 * /catalogue/fournisseurs/procity qui suit la taxonomie à 3 niveaux. On redirige
 * permanemment pour conserver les liens externes et le SEO.
 */
export default function Page() {
  redirect("/catalogue/fournisseurs/procity")
}
