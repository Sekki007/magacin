/** Zvanične boje kućišta po modelu (za seed poklopci artikala). */
export const POKLOPCI_MODEL_BOJE: Record<string, readonly string[]> = {
  'iPhone 11': ['Crna', 'Bela', 'Ljubičasta', 'Zelena', 'Žuta', 'Crvena'],
  'iPhone 11 Pro': ['Siva', 'Srebrna', 'Zlatna', 'Tamno zelena'],
  'iPhone 11 Pro Max': ['Siva', 'Srebrna', 'Zlatna', 'Tamno zelena'],

  'iPhone 12 mini': ['Crna', 'Bela', 'Plava', 'Zelena', 'Ljubičasta', 'Crvena'],
  'iPhone 12': ['Crna', 'Bela', 'Plava', 'Zelena', 'Ljubičasta', 'Crvena'],
  'iPhone 12 Pro': ['Grafit', 'Srebrna', 'Zlatna', 'Morsko plava'],
  'iPhone 12 Pro Max': ['Grafit', 'Srebrna', 'Zlatna', 'Morsko plava'],

  'iPhone 13 mini': ['Midnight', 'Starlight', 'Plava', 'Roze', 'Zelena', 'Crvena'],
  'iPhone 13': ['Midnight', 'Starlight', 'Plava', 'Roze', 'Zelena', 'Crvena'],
  'iPhone 13 Pro': ['Grafit', 'Zlatna', 'Srebrna', 'Svetlo plava', 'Tamno zelena'],
  'iPhone 13 Pro Max': ['Grafit', 'Zlatna', 'Srebrna', 'Svetlo plava', 'Tamno zelena'],

  'iPhone 14': ['Midnight', 'Starlight', 'Plava', 'Ljubičasta', 'Žuta', 'Crvena'],
  'iPhone 14 Plus': ['Midnight', 'Starlight', 'Plava', 'Ljubičasta', 'Žuta', 'Crvena'],
  'iPhone 14 Pro': ['Crna', 'Srebrna', 'Zlatna', 'Deep Purple'],
  'iPhone 14 Pro Max': ['Crna', 'Srebrna', 'Zlatna', 'Deep Purple'],

  'iPhone 15': ['Crna', 'Plava', 'Zelena', 'Žuta', 'Roze'],
  'iPhone 15 Plus': ['Crna', 'Plava', 'Zelena', 'Žuta', 'Roze'],
  'iPhone 15 Pro': ['Black Titanium', 'White Titanium', 'Blue Titanium', 'Natural Titanium'],
  'iPhone 15 Pro Max': ['Black Titanium', 'White Titanium', 'Blue Titanium', 'Natural Titanium'],

  'iPhone 16': ['Crna', 'Bela', 'Roze', 'Tirkizna', 'Tamno plava'],
  'iPhone 16 Plus': ['Crna', 'Bela', 'Roze', 'Tirkizna', 'Tamno plava'],
  'iPhone 16 Pro': ['Black Titanium', 'White Titanium', 'Natural Titanium', 'Champagne'],
  'iPhone 16 Pro Max': ['Black Titanium', 'White Titanium', 'Natural Titanium', 'Champagne'],
  'iPhone 16e': ['Crna', 'Bela'],

  'iPhone 17': ['Crna', 'Bela', 'Svetlo plava', 'Zelena', 'Ljubičasta'],
  'iPhone 17 Air': ['Plava', 'Zlatna', 'Bela', 'Crna'],
  'iPhone 17 Pro': ['Srebrna', 'Narandžasta', 'Tamno plava'],
  'iPhone 17 Pro Max': ['Srebrna', 'Narandžasta', 'Tamno plava'],
}

export function sveKombinacijePoklopaca(): { model: string; boja: string }[] {
  return Object.entries(POKLOPCI_MODEL_BOJE).flatMap(([model, boje]) =>
    boje.map(boja => ({ model, boja }))
  )
}
