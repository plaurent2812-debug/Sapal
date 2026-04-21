export interface VariantSnapshot {
  variantRef: string;
  attributes: Record<string, string>;
  ral?: string;
  availability?: string;
  imageFilenames: string[];
}

export interface CharacteristicRow {
  label: string;
  value: string;
}

export type Universe = 'mobilier-urbain' | 'aires-de-jeux' | 'equipements-sportifs';

export interface ProductSnapshot {
  reference: string;
  procityUrl: string;
  universe: Universe;
  categoryPath: string[];
  title: string;
  descriptionRaw: string;
  availabilityDefault?: string;
  weightKg?: number;
  dimensions?: string;
  type?: string;
  characteristics: CharacteristicRow[];
  variants: VariantSnapshot[];
  galleryFilenames: string[];
  techSheetFilename?: string;
  scrapedAt: string;
  contentHash: string;
}

export interface ScraperState {
  version: 1;
  runStartedAt: string;
  entries: Record<string, { hash: string; lastSeenAt: string }>;
}
