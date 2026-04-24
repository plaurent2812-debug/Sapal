import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "SAPAL Signalisation — Mobilier urbain & signalétique pour collectivités"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "linear-gradient(135deg, #0e1e3a 0%, #1e3a5f 55%, #23466e 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#0e1e3a",
            }}
          >
            S
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>
              SAPAL
            </div>
            <div
              style={{
                fontSize: 18,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#f59e0b",
              }}
            >
              Signalisation
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            Mobilier urbain & signalétique
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 500,
              color: "rgba(255,255,255,0.75)",
              maxWidth: 980,
            }}
          >
            Fournisseur B2B pour collectivités — livraison partout en France.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "rgba(255,255,255,0.65)",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: 24,
          }}
        >
          <span>www.sapal.fr</span>
          <span>Basés à Cannes · Livraison France</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
