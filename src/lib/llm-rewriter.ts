import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY missing');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export interface RewriteInput {
  title: string;
  descriptionRaw: string;
  characteristics: { label: string; value: string }[];
}

const SYSTEM_PROMPT = `Tu es rédacteur catalogue pour SAPAL Signalisation, revendeur basé à Cannes, qui vend du mobilier urbain et de la signalisation à des collectivités et professionnels.

Tu réécris des descriptions produits en respectant ces règles :
- 80 à 150 mots, ton sobre et factuel (ni promotionnel ni plat)
- Pas de superlatifs creux ("incontournable", "exceptionnel", "gamme premium")
- Pas de mention de la marque du fabricant (Procity, Vialux, etc.) — SAPAL est le revendeur
- Pas de copie littérale de la source (reformulation complète)
- Pas d'invention : ne parle que de ce qui est dans la source ou les caractéristiques techniques fournies
- Structure implicite : à quoi ça sert, pour qui, ce qui le caractérise
- Français professionnel, sans fautes, sans anglicismes inutiles
- N'utilise PAS de formules d'ouverture ("Voici", "Découvrez", "Ce produit est")`;

export async function rewriteDescription(input: RewriteInput): Promise<string> {
  const userMessage = [
    `Titre : ${input.title}`,
    `Description source : ${input.descriptionRaw.slice(0, 3000)}`,
    `Caractéristiques : ${input.characteristics
      .slice(0, 20)
      .map((c) => `${c.label} = ${c.value}`)
      .join(' ; ')}`,
    '',
    'Réécris cette description pour le catalogue SAPAL, directement sans préambule.',
  ].join('\n');

  const response = await client().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('LLM returned no text');
  return text.text.trim();
}
