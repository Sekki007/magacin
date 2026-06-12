import { writeFileSync } from 'fs'
import { POKLOPCI_MODEL_BOJE } from '../src/lib/poklopciModelBoje.ts'
import { nazivPoklopca } from '../src/lib/poklopciKatalog.ts'

const rows = []
for (const [model, boje] of Object.entries(POKLOPCI_MODEL_BOJE)) {
  for (const boja of boje) {
    const naziv = nazivPoklopca(model, boja).replace(/'/g, "''")
    rows.push(`  ('${naziv.replace(/'/g, "''")}', '${model.replace(/'/g, "''")}', '${boja.replace(/'/g, "''")}', 0, 0, 0)`)
  }
}

const sql = `-- Auto-generisano — svi modeli × zvanične boje, cena i količina 0
-- Pokreni u Supabase SQL Editor (preskače postojeće model+boja)

insert into public.poklopci_artikli (naziv, model, boja, kolicina, nabavna_cena, prodajna_cena)
select v.naziv, v.model, v.boja, v.kolicina, v.nabavna, v.prodajna
from (values
${rows.join(',\n')}
) as v(naziv, model, boja, kolicina, nabavna, prodajna)
where not exists (
  select 1 from public.poklopci_artikli a
  where a.model = v.model and a.boja = v.boja
);
`

writeFileSync('supabase/poklopci_seed_artikli.sql', sql)
console.log('Generated', rows.length, 'combinations')
