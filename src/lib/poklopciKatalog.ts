export const DEFAULT_MODELI = [
  'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
  'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
  'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 16e',
  'iPhone 17', 'iPhone 17 Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max',
] as const

export const DEFAULT_BOJE = [
  'Crna', 'Bela', 'Transparentna', 'Providna (mat)',
  'Plava', 'Tamno plava', 'Svetlo plava', 'Morsko plava',
  'Crvena', 'Tamno crvena', 'Roze', 'Svetlo roze',
  'Ljubičasta', 'Deep Purple',
  'Zelena', 'Tamno zelena', 'Mint zelena',
  'Narandžasta', 'Žuta',
  'Zlatna', 'Srebrna', 'Siva', 'Tamno siva', 'Grafit',
  'Bež', 'Braon', 'Champagne', 'Tirkizna',
  'Midnight', 'Starlight',
  'Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium',
] as const

export function nazivPoklopca(model: string, boja: string): string {
  return `${model} — ${boja}`
}
