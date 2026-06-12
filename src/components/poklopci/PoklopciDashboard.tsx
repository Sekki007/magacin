'use client'

import { supabase } from '@/lib/supabase'
import { DEFAULT_BOJE, DEFAULT_MODELI, nazivPoklopca } from '@/lib/poklopciKatalog'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DevicePhoneMobileIcon,
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChartBarIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline'

type Artikal = {
  id: string
  naziv: string
  model: string
  boja: string
  kolicina: number
  nabavna_cena: number
  prodajna_cena: number
}

type Rezervacija = {
  id: string
  artikal_id: string
  kolicina: number
  kome: string
  napomena: string | null
  datum_rezervacije: string
  razduzeno: boolean
  cena_po_komadu?: number | null
  poklopci_artikli?: { naziv: string; model: string; boja: string; nabavna_cena: number; prodajna_cena: number; kolicina?: number }
}

type Prodaja = {
  id: string
  kolicina_prodato: number
  cena_po_komadu: number
  ukupna_zarada: number
  prodavac_username: string | null
  datum: string
  poklopci_artikli?: { naziv: string; model: string; boja: string }
}

type OsobaDugovanje = {
  kome: string
  stavke: Rezervacija[]
  ukupno: number
  avans: number
  preostalo: number
  dana: number
}

type DugAvans = { kome: string; iznos: number }

type ModelGrupa = {
  model: string
  stavke: Artikal[]
  ukupnoKom: number
  ukupnoVrednost: number
  imaMalo: boolean
}

function danaOd(datum: string): number {
  return Math.floor((Date.now() - new Date(datum).getTime()) / (1000 * 60 * 60 * 24))
}

function badgeStarosti(dana: number): string {
  if (dana >= 7) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (dana >= 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
}

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PoklopciDashboard() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [artikli, setArtikli] = useState<Artikal[]>([])
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [prodaje, setProdaje] = useState<Prodaja[]>([])
  const [modeli, setModeli] = useState<string[]>([...DEFAULT_MODELI])
  const [boje, setBoje] = useState<string[]>([...DEFAULT_BOJE])
  const [stanjeKase, setStanjeKase] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pretraga, setPretraga] = useState('')
  const [filterModel, setFilterModel] = useState('')

  const [showInfoBar, setShowInfoBar] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [izabraniModel, setIzabraniModel] = useState('')
  const [izabranaBoja, setIzabranaBoja] = useState('')
  const [kolicina, setKolicina] = useState('')
  const [nabavna, setNabavna] = useState('')
  const [prodajna, setProdajna] = useState('')

  const [showNoviModel, setShowNoviModel] = useState(false)
  const [noviModelTekst, setNoviModelTekst] = useState('')
  const [showNovaBoja, setShowNovaBoja] = useState(false)
  const [novaBojaTekst, setNovaBojaTekst] = useState('')

  const [showProdaja, setShowProdaja] = useState(false)
  const [prodajaArtikal, setProdajaArtikal] = useState<Artikal | null>(null)
  const [prodajaKolicina, setProdajaKolicina] = useState(1)
  const [prodajaCena, setProdajaCena] = useState(0)

  const [showRezervacija, setShowRezervacija] = useState(false)
  const [rezArtikal, setRezArtikal] = useState<Artikal | null>(null)
  const [rezKolicina, setRezKolicina] = useState(1)
  const [rezKome, setRezKome] = useState('')
  const [rezNapomena, setRezNapomena] = useState('')

  const [showDugovanja, setShowDugovanja] = useState(false)
  const [otvorenaOsoba, setOtvorenaOsoba] = useState<string | null>(null)
  const [izabraneStavke, setIzabraneStavke] = useState<Set<string>>(new Set())

  const [showPreimenuj, setShowPreimenuj] = useState(false)
  const [preimenujStaro, setPreimenujStaro] = useState('')
  const [preimenujNovo, setPreimenujNovo] = useState('')

  const [showResetKase, setShowResetKase] = useState(false)
  const [resetCode, setResetCode] = useState('')

  const [showPregledProdaje, setShowPregledProdaje] = useState(false)
  const [otvoreniModeli, setOtvoreniModeli] = useState<Set<string>>(new Set())
  const [autoExpandGrupe, setAutoExpandGrupe] = useState(true)
  const [formModelZakljucan, setFormModelZakljucan] = useState(false)

  const [dugAvansi, setDugAvansi] = useState<DugAvans[]>([])
  const [showDelimicnoPlacanje, setShowDelimicnoPlacanje] = useState(false)
  const [delimicnoIznos, setDelimicnoIznos] = useState('')
  const [delimicnoNapomena, setDelimicnoNapomena] = useState('')
  const [showIzmenaStavke, setShowIzmenaStavke] = useState(false)
  const [izmenaStavkaRez, setIzmenaStavkaRez] = useState<Rezervacija | null>(null)
  const [izmenaKolicina, setIzmenaKolicina] = useState(1)
  const [izmenaCena, setIzmenaCena] = useState(0)

  function spojiKatalog(dbLista: string[], podrazumevano: readonly string[]): string[] {
    return [...new Set([...podrazumevano, ...dbLista])]
  }

  async function seedKatalogAkoPrazan(): Promise<boolean> {
    const [{ count: mc, error: mcErr }, { count: bc, error: bcErr }] = await Promise.all([
      supabase.from('poklopci_modeli').select('*', { count: 'exact', head: true }),
      supabase.from('poklopci_boje').select('*', { count: 'exact', head: true }),
    ])
    if (mcErr || bcErr) return false
    if ((mc ?? 0) === 0) {
      const { error } = await supabase.from('poklopci_modeli').insert(
        DEFAULT_MODELI.map((naziv, i) => ({ naziv, redosled: (i + 1) * 10 }))
      )
      if (error) return false
    }
    if ((bc ?? 0) === 0) {
      const { error } = await supabase.from('poklopci_boje').insert(
        DEFAULT_BOJE.map((naziv, i) => ({ naziv, redosled: i + 1 }))
      )
      if (error) return false
    }
    return true
  }

  async function ucitajKatalog() {
    const dbOk = await seedKatalogAkoPrazan()
    const [{ data: m, error: mErr }, { data: b, error: bErr }] = await Promise.all([
      supabase.from('poklopci_modeli').select('naziv').order('redosled', { ascending: true }),
      supabase.from('poklopci_boje').select('naziv').order('redosled', { ascending: true }),
    ])
    const dbModeli = mErr ? [] : (m || []).map(x => x.naziv)
    const dbBoje = bErr ? [] : (b || []).map(x => x.naziv)
    setModeli(spojiKatalog(dbModeli, DEFAULT_MODELI))
    setBoje(spojiKatalog(dbBoje, DEFAULT_BOJE))
    if (!dbOk || mErr || bErr) {
      toast.error('Katalog tabele nisu u bazi — koriste se ugrađene liste. Pokreni poklopci_katalog.sql u Supabase.', { duration: 6000 })
    }
  }

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, uloga, active')
      .eq('id', user.id)
      .single()
    if (!profile || profile.uloga !== 'admin' || profile.active === false) {
      toast.error('Samo admin ima pristup modulu poklopci.')
      router.push('/')
      return
    }
    setUsername(profile.username)
    await Promise.all([ucitajKatalog(), ucitajArtikle(), ucitajRezervacije(), ucitajKasu(), ucitajProdaje(), ucitajDugAvanse()])
  }

  async function ucitajDugAvanse() {
    const { data, error } = await supabase.from('poklopci_dugovanja_avans').select('kome, iznos')
    if (error) { setDugAvansi([]); return }
    setDugAvansi((data || []).map(r => ({ kome: r.kome, iznos: Number(r.iznos ?? 0) })))
  }

  async function ucitajArtikle() {
    const { data, error } = await supabase
      .from('poklopci_artikli')
      .select('*')
      .order('model', { ascending: true })
    if (error) {
      toast.error('Greška pri učitavanju poklopaca.')
      return
    }
    setArtikli((data || []).map(a => ({
      id: a.id,
      naziv: a.naziv,
      model: a.model || '',
      boja: a.boja || '',
      kolicina: Number(a.kolicina ?? 0),
      nabavna_cena: Number(a.nabavna_cena ?? 0),
      prodajna_cena: Number(a.prodajna_cena ?? 0),
    })))
  }

  async function ucitajRezervacije() {
    const { data, error } = await supabase
      .from('poklopci_rezervacije')
      .select('*, poklopci_artikli(naziv, model, boja, nabavna_cena, prodajna_cena, kolicina)')
      .eq('razduzeno', false)
      .order('datum_rezervacije', { ascending: false })
    if (error) {
      toast.error('Greška pri učitavanju rezervacija.')
      setRezervacije([])
      return
    }
    setRezervacije(data || [])
  }

  async function ucitajProdaje() {
    const { data, error } = await supabase
      .from('poklopci_prodaje')
      .select('*, poklopci_artikli(naziv, model, boja)')
      .order('datum', { ascending: false })
      .limit(200)
    if (error) {
      setProdaje([])
      return
    }
    setProdaje((data || []).map(p => ({
      ...p,
      kolicina_prodato: Number(p.kolicina_prodato),
      cena_po_komadu: Number(p.cena_po_komadu),
      ukupna_zarada: Number(p.ukupna_zarada),
    })))
  }

  async function ucitajKasu() {
    const { data, error } = await supabase.from('poklopci_kasa').select('stanje_zarada').eq('id', 1).single()
    if (!error) setStanjeKase(Number(data?.stanje_zarada ?? 0))
  }

  useEffect(() => { init() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showNoviModel) { setShowNoviModel(false); return }
      if (showNovaBoja) { setShowNovaBoja(false); return }
      if (showIzmenaStavke) { setShowIzmenaStavke(false); return }
      if (showDelimicnoPlacanje) { setShowDelimicnoPlacanje(false); return }
      if (showPreimenuj) { setShowPreimenuj(false); return }
      if (showResetKase) { setShowResetKase(false); setResetCode(''); return }
      if (showPregledProdaje) { setShowPregledProdaje(false); return }
      if (showDugovanja) {
        if (otvorenaOsoba) { setOtvorenaOsoba(null); setIzabraneStavke(new Set()) }
        else setShowDugovanja(false)
        return
      }
      if (showForm) { setShowForm(false); setEditId(null); return }
      if (showProdaja) { setShowProdaja(false); return }
      if (showRezervacija) { setShowRezervacija(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showNoviModel, showNovaBoja, showIzmenaStavke, showDelimicnoPlacanje, showPreimenuj, showResetKase, showPregledProdaje, showDugovanja, otvorenaOsoba, showForm, showProdaja, showRezervacija])

  function avansZaOsobu(kome: string): number {
    return Number(dugAvansi.find(a => a.kome === kome)?.iznos ?? 0)
  }

  function cenaStavke(rez: Rezervacija): number {
    if (rez.cena_po_komadu != null) {
      return Number(rez.cena_po_komadu)
    }
    const a = rez.poklopci_artikli || artikli.find(x => x.id === rez.artikal_id)
    return Number(a?.nabavna_cena ?? 0)
  }

  function otvoriIzmenuStavke(rez: Rezervacija) {
    setIzmenaStavkaRez(rez)
    setIzmenaKolicina(rez.kolicina)
    setIzmenaCena(cenaStavke(rez))
    setShowIzmenaStavke(true)
  }

  async function sacuvajIzmenuStavke() {
    if (!izmenaStavkaRez) return
    const novaKol = Math.floor(Number(izmenaKolicina))
    const novaCena = Number(izmenaCena)
    if (novaKol <= 0 || novaCena <= 0) { toast.error('Količina i cena moraju biti > 0.'); return }
    setLoading(true)
    const rez = izmenaStavkaRez
    const diff = novaKol - rez.kolicina
    const art = artikli.find(x => x.id === rez.artikal_id)
    if (diff > 0) {
      const naStanju = Number(art?.kolicina ?? 0)
      if (naStanju < diff) { toast.error(`Nema dovoljno na stanju (${naStanju} kom).`); setLoading(false); return }
      const { error } = await supabase.from('poklopci_artikli').update({ kolicina: naStanju - diff }).eq('id', rez.artikal_id)
      if (error) { toast.error('Greška pri skidanju sa stanja.'); setLoading(false); return }
    } else if (diff < 0) {
      const { error } = await supabase.from('poklopci_artikli').update({ kolicina: Number(art?.kolicina ?? 0) + (-diff) }).eq('id', rez.artikal_id)
      if (error) { toast.error('Greška pri vraćanju na stanje.'); setLoading(false); return }
    }
    const { error } = await supabase.from('poklopci_rezervacije').update({ kolicina: novaKol, cena_po_komadu: novaCena }).eq('id', rez.id)
    setLoading(false)
    if (error) {
      toast.error(error.message.includes('cena_po_komadu') ? 'Pokreni poklopci_dugovanja_upgrade.sql u Supabase.' : 'Greška pri čuvanju.')
      return
    }
    setShowIzmenaStavke(false)
    toast.success('Stavka izmenjena.')
    await Promise.all([ucitajRezervacije(), ucitajArtikle()])
  }

  async function evidentirajDelimicnoPlacanje() {
    if (!otvorenaOsoba || !osobaDetalj) return
    const iznos = Number(delimicnoIznos)
    if (!iznos || iznos <= 0) { toast.error('Unesi iznos.'); return }
    if (iznos > osobaDetalj.preostalo + 0.005) {
      toast.error(`Maksimum: ${osobaDetalj.preostalo.toFixed(2)} €`)
      return
    }
    setLoading(true)
    const noviAvans = avansZaOsobu(otvorenaOsoba) + iznos
    const [avRes, uplRes, kasRes] = await Promise.all([
      supabase.from('poklopci_dugovanja_avans').upsert({ kome: otvorenaOsoba, iznos: noviAvans }),
      supabase.from('poklopci_dugovanja_uplate').insert({
        kome: otvorenaOsoba, iznos, napomena: delimicnoNapomena.trim() || null, uneto_od: username,
      }),
      supabase.from('poklopci_kasa').update({ stanje_zarada: stanjeKase + iznos }).eq('id', 1),
    ])
    setLoading(false)
    if (avRes.error || uplRes.error || kasRes.error) {
      toast.error('Greška — pokreni poklopci_dugovanja_upgrade.sql u Supabase.')
      return
    }
    setStanjeKase(prev => prev + iznos)
    setShowDelimicnoPlacanje(false)
    setDelimicnoIznos('')
    setDelimicnoNapomena('')
    await Promise.all([ucitajDugAvanse(), ucitajKasu()])
    toast.success(`Uplaćeno ${iznos.toFixed(2)} €. Preostalo: ${(osobaDetalj.preostalo - iznos).toFixed(2)} €`)
  }

  function labelArtikla(a: { model?: string; boja?: string; naziv?: string }): string {
    if (a.model && a.boja) return nazivPoklopca(a.model, a.boja)
    return a.naziv || '—'
  }

  const vrednostLagera = artikli.reduce((s, a) => s + a.nabavna_cena * a.kolicina, 0)
  const ukupnoProdato = prodaje.reduce((s, p) => s + p.ukupna_zarada, 0)
  const ukupnoKomadaProdato = prodaje.reduce((s, p) => s + p.kolicina_prodato, 0)

  const dugovanjaPoOsobi: OsobaDugovanje[] = (() => {
    const map = new Map<string, Rezervacija[]>()
    for (const r of rezervacije) {
      if (!map.has(r.kome)) map.set(r.kome, [])
      map.get(r.kome)!.push(r)
    }
    return Array.from(map.entries())
      .map(([kome, stavke]) => {
        const ukupno = stavke.reduce((s, r) => s + cenaStavke(r) * r.kolicina, 0)
        const avans = avansZaOsobu(kome)
        return {
          kome,
          stavke,
          ukupno,
          avans,
          preostalo: Math.max(0, ukupno - avans),
          dana: Math.max(...stavke.map(x => danaOd(x.datum_rezervacije))),
        }
      })
      .sort((a, b) => b.dana - a.dana || b.preostalo - a.preostalo)
  })()

  const ukupnoDugovanja = dugovanjaPoOsobi.reduce((s, o) => s + o.preostalo, 0)
  const osobaDetalj = otvorenaOsoba ? dugovanjaPoOsobi.find(o => o.kome === otvorenaOsoba) : null
  const predloziZaRez = dugovanjaPoOsobi.map(o => ({ name: o.kome, count: o.stavke.length }))

  const filtrirani = artikli.filter(a => {
    if (filterModel && a.model !== filterModel) return false
    const q = pretraga.toLowerCase().trim()
    if (!q) return true
    return a.model.toLowerCase().includes(q) || a.boja.toLowerCase().includes(q) || a.naziv.toLowerCase().includes(q)
  })

  function redosledModela(m: string): number {
    const i = modeli.indexOf(m)
    return i >= 0 ? i : 9999
  }

  const grupePoModelu: ModelGrupa[] = (() => {
    const map = new Map<string, Artikal[]>()
    for (const a of filtrirani) {
      if (!map.has(a.model)) map.set(a.model, [])
      map.get(a.model)!.push(a)
    }
    return Array.from(map.entries())
      .map(([model, stavke]) => {
        const sortirane = [...stavke].sort((x, y) => x.boja.localeCompare(y.boja, 'sr'))
        return {
          model,
          stavke: sortirane,
          ukupnoKom: sortirane.reduce((s, a) => s + a.kolicina, 0),
          ukupnoVrednost: sortirane.reduce((s, a) => s + a.nabavna_cena * a.kolicina, 0),
          imaMalo: sortirane.some(a => a.kolicina <= 1),
        }
      })
      .sort((a, b) => redosledModela(a.model) - redosledModela(b.model) || a.model.localeCompare(b.model, 'sr', { numeric: true }))
  })()

  const postojeceBojeZaModel = izabraniModel
    ? artikli.filter(a => a.model === izabraniModel && a.id !== editId).map(a => a.boja)
    : []

  const dostupneBoje = boje.filter(b => !postojeceBojeZaModel.includes(b) || b === izabranaBoja)

  function toggleModel(model: string) {
    setAutoExpandGrupe(false)
    setOtvoreniModeli(prev => {
      const n = new Set(autoExpandGrupe ? grupePoModelu.map(g => g.model) : prev)
      if (n.has(model)) n.delete(model)
      else n.add(model)
      return n
    })
  }

  function jeOtvoren(model: string): boolean {
    if (pretraga.trim() || filterModel) return true
    if (autoExpandGrupe) return true
    return otvoreniModeli.has(model)
  }

  function resetForme() {
    setIzabraniModel(''); setIzabranaBoja(''); setKolicina(''); setNabavna(''); setProdajna('')
  }

  function osigurajKatalog() {
    if (modeli.length === 0) setModeli([...DEFAULT_MODELI])
    if (boje.length === 0) setBoje([...DEFAULT_BOJE])
  }

  function otvoriDodavanje() {
    osigurajKatalog()
    setEditId(null); resetForme(); setFormModelZakljucan(false); setShowForm(true)
  }

  function otvoriDodavanjeBoje(model: string) {
    osigurajKatalog()
    setEditId(null)
    resetForme()
    setIzabraniModel(model)
    setFormModelZakljucan(true)
    setOtvoreniModeli(prev => new Set(prev).add(model))
    setShowForm(true)
  }

  function izmeniArtikal(a: Artikal) {
    osigurajKatalog()
    setFormModelZakljucan(true)
    setEditId(a.id)
    setIzabraniModel(a.model)
    setIzabranaBoja(a.boja)
    setKolicina(String(a.kolicina))
    setNabavna(String(a.nabavna_cena))
    setProdajna(String(a.prodajna_cena))
    setShowForm(true)
  }

  async function dodajModel() {
    const naziv = noviModelTekst.trim()
    if (!naziv) return
    const { error } = await supabase.from('poklopci_modeli').insert({ naziv, redosled: (modeli.length + 1) * 10 })
    if (error) {
      toast.error(error.code === '23505' ? 'Model već postoji.' : 'Greška.')
      return
    }
    toast.success(`Model "${naziv}" dodat.`)
    setNoviModelTekst(''); setShowNoviModel(false)
    await ucitajKatalog()
    setIzabraniModel(naziv)
  }

  async function dodajBoju() {
    const naziv = novaBojaTekst.trim()
    if (!naziv) return
    const { error } = await supabase.from('poklopci_boje').insert({ naziv, redosled: boje.length + 1 })
    if (error) {
      toast.error(error.code === '23505' ? 'Boja već postoji.' : 'Greška.')
      return
    }
    toast.success(`Boja "${naziv}" dodata.`)
    setNovaBojaTekst(''); setShowNovaBoja(false)
    await ucitajKatalog()
    setIzabranaBoja(naziv)
  }

  async function sacuvajArtikal(e: React.FormEvent) {
    e.preventDefault()
    if (!izabraniModel || !izabranaBoja) {
      toast.error('Izaberi model i boju.')
      return
    }
    const duplikat = artikli.find(a => a.model === izabraniModel && a.boja === izabranaBoja && a.id !== editId)
    if (duplikat) {
      toast.error(`Već postoji: ${nazivPoklopca(izabraniModel, izabranaBoja)}`)
      return
    }
    setLoading(true)
    const payload = {
      naziv: nazivPoklopca(izabraniModel, izabranaBoja),
      model: izabraniModel,
      boja: izabranaBoja,
      kolicina: Number(kolicina),
      nabavna_cena: Number(nabavna),
      prodajna_cena: Number(prodajna),
    }
    const res = editId
      ? await supabase.from('poklopci_artikli').update(payload).eq('id', editId)
      : await supabase.from('poklopci_artikli').insert(payload)
    setLoading(false)
    if (res.error) {
      toast.error(res.error.message.includes('boja')
        ? 'Nedostaje kolona "boja" u bazi — pokreni poklopci_katalog.sql u Supabase.'
        : `Greška pri čuvanju: ${res.error.message}`)
      return
    }
    toast.success(editId ? 'Izmenjeno.' : 'Dodato.')
    setShowForm(false); resetForme()
    await ucitajArtikle()
  }

  async function obrisiArtikal(id: string) {
    const artikal = artikli.find(a => a.id === id)
    const [{ data: otvorene }, { data: sveRez }, { data: prodajeZaArt }] = await Promise.all([
      supabase.from('poklopci_rezervacije').select('id').eq('artikal_id', id).eq('razduzeno', false),
      supabase.from('poklopci_rezervacije').select('id').eq('artikal_id', id),
      supabase.from('poklopci_prodaje').select('id').eq('artikal_id', id),
    ])
    if ((otvorene?.length ?? 0) > 0) {
      toast.error('Ne može se obrisati — artikal ima otvoreno dugovanje. Prvo razduži ili vrati na stanje.')
      return
    }
    const brProdaja = prodajeZaArt?.length ?? 0
    const brRez = sveRez?.length ?? 0
    const poruka = brProdaja > 0 || brRez > 0
      ? `Obrisati "${artikal ? labelArtikla(artikal) : 'poklopac'}"?\n\nBriše se i povezana istorija (${brProdaja} prodaja, ${brRez} rezervacija).`
      : 'Obrisati poklopac?'
    if (!confirm(poruka)) return
    setLoading(true)
    if (brRez > 0) {
      const { error } = await supabase.from('poklopci_rezervacije').delete().eq('artikal_id', id)
      if (error) { setLoading(false); toast.error(`Greška pri brisanju rezervacija: ${error.message}`); return }
    }
    if (brProdaja > 0) {
      const { error } = await supabase.from('poklopci_prodaje').delete().eq('artikal_id', id)
      if (error) { setLoading(false); toast.error(`Greška pri brisanju prodaja: ${error.message}`); return }
    }
    const { error } = await supabase.from('poklopci_artikli').delete().eq('id', id)
    setLoading(false)
    if (error) { toast.error(`Greška pri brisanju: ${error.message}`); return }
    toast.success('Obrisano.')
    await Promise.all([ucitajArtikle(), ucitajRezervacije(), ucitajProdaje()])
  }

  function otvoriProdaju(a: Artikal) {
    setProdajaArtikal(a); setProdajaKolicina(1); setProdajaCena(a.prodajna_cena); setShowProdaja(true)
  }

  async function izvrsiProdaju() {
    if (!prodajaArtikal || prodajaKolicina <= 0 || prodajaKolicina > prodajaArtikal.kolicina) {
      toast.error('Proveri količinu.'); return
    }
    setLoading(true)
    const zarada = prodajaCena * prodajaKolicina
    const [u1, u2, u3] = await Promise.all([
      supabase.from('poklopci_artikli').update({ kolicina: prodajaArtikal.kolicina - prodajaKolicina }).eq('id', prodajaArtikal.id),
      supabase.from('poklopci_prodaje').insert({
        artikal_id: prodajaArtikal.id,
        kolicina_prodato: prodajaKolicina,
        cena_po_komadu: prodajaCena,
        ukupna_zarada: zarada,
        prodavac_username: username,
      }),
      supabase.from('poklopci_kasa').update({ stanje_zarada: stanjeKase + zarada }).eq('id', 1),
    ])
    setLoading(false)
    if (u1.error || u2.error || u3.error) { toast.error('Greška pri prodaji.'); return }
    toast.success(`Prodato ${prodajaKolicina} × ${labelArtikla(prodajaArtikal)}`)
    setShowProdaja(false)
    setStanjeKase(prev => prev + zarada)
    await Promise.all([ucitajArtikle(), ucitajKasu(), ucitajProdaje()])
  }

  function otvoriRezervaciju(a: Artikal) {
    setRezArtikal(a); setRezKolicina(1); setRezKome(''); setRezNapomena(''); setShowRezervacija(true)
  }

  async function sacuvajRezervaciju() {
    const kome = rezKome.trim()
    if (!rezArtikal || !kome || rezKolicina <= 0 || rezKolicina > rezArtikal.kolicina) {
      toast.error('Proveri podatke.'); return
    }
    setLoading(true)
    const [u1, u2] = await Promise.all([
      supabase.from('poklopci_artikli').update({ kolicina: rezArtikal.kolicina - rezKolicina }).eq('id', rezArtikal.id),
      supabase.from('poklopci_rezervacije').insert({
        artikal_id: rezArtikal.id,
        kolicina: rezKolicina,
        kome,
        napomena: rezNapomena.trim() || null,
      }),
    ])
    setLoading(false)
    if (u1.error || u2.error) { toast.error('Greška pri rezervaciji.'); return }
    toast.success(`Rezervisano za "${kome}"`)
    setShowRezervacija(false)
    await Promise.all([ucitajArtikle(), ucitajRezervacije()])
  }

  async function razduziStavke(stavke: Rezervacija[], placeno: boolean) {
    if (stavke.length === 0) return
    setLoading(true)
    let kasa = stanjeKase
    const kome = stavke[0]?.kome
    const stavkeTotal = stavke.reduce((s, r) => s + cenaStavke(r) * r.kolicina, 0)
    const avans = placeno && kome ? avansZaOsobu(kome) : 0
    const saAvansa = Math.min(avans, stavkeTotal)
    const naKasu = stavkeTotal - saAvansa

    for (const rez of stavke) {
      const cena = cenaStavke(rez)
      const zarada = cena * rez.kolicina
      if (placeno) {
        const { error: pErr } = await supabase.from('poklopci_prodaje').insert({
          artikal_id: rez.artikal_id,
          kolicina_prodato: rez.kolicina,
          cena_po_komadu: cena,
          ukupna_zarada: zarada,
          prodavac_username: username,
        })
        if (pErr) { setLoading(false); toast.error('Greška.'); return }
      } else {
        const a = artikli.find(x => x.id === rez.artikal_id)
        if (a) await supabase.from('poklopci_artikli').update({ kolicina: a.kolicina + rez.kolicina }).eq('id', rez.artikal_id)
      }
      await supabase.from('poklopci_rezervacije').update({ razduzeno: true }).eq('id', rez.id)
    }

    if (placeno) {
      if (naKasu > 0) {
        const { error: kErr } = await supabase.from('poklopci_kasa').update({ stanje_zarada: kasa + naKasu }).eq('id', 1)
        if (kErr) { setLoading(false); toast.error('Greška pri kasi.'); return }
        kasa += naKasu
      }
      if (saAvansa > 0 && kome) {
        const noviAvans = avans - saAvansa
        if (noviAvans <= 0.005) await supabase.from('poklopci_dugovanja_avans').delete().eq('kome', kome)
        else await supabase.from('poklopci_dugovanja_avans').upsert({ kome, iznos: noviAvans })
      }
    }

    setStanjeKase(kasa)
    setLoading(false)
    setIzabraneStavke(new Set())
    if (otvorenaOsoba && osobaDetalj && stavke.length === osobaDetalj.stavke.length) setOtvorenaOsoba(null)
    if (placeno) {
      toast.success(saAvansa > 0
        ? `Plaćeno — ${naKasu.toFixed(2)} € na kasu (${saAvansa.toFixed(2)} € iz avansa)`
        : `Plaćeno ${stavkeTotal.toFixed(2)} €`)
    } else {
      toast.success('Vraćeno na stanje.')
    }
    await Promise.all([ucitajArtikle(), ucitajRezervacije(), ucitajKasu(), ucitajProdaje(), ucitajDugAvanse()])
  }

  async function sacuvajPreimenovanje() {
    const staro = preimenujStaro.trim()
    const novo = preimenujNovo.trim()
    if (!staro || !novo || staro.toLowerCase() === novo.toLowerCase()) return
    const ids = rezervacije.filter(r => r.kome === staro).map(r => r.id)
    const cilj = dugovanjaPoOsobi.find(o => o.kome.toLowerCase() === novo.toLowerCase() && o.kome !== staro)
    if (!confirm(cilj ? `Spojiti "${staro}" sa "${cilj.kome}"?` : `Preimenovati u "${novo}"?`)) return
    const finalnoIme = cilj ? cilj.kome : novo
    const avansStaro = avansZaOsobu(staro)
    const { error } = await supabase.from('poklopci_rezervacije').update({ kome: finalnoIme }).in('id', ids)
    if (error) { toast.error('Greška.'); return }
    if (avansStaro > 0) {
      const avansCilj = cilj ? avansZaOsobu(cilj.kome) : 0
      await supabase.from('poklopci_dugovanja_avans').delete().eq('kome', staro)
      const novi = cilj ? avansStaro + avansCilj : avansStaro
      if (novi > 0) await supabase.from('poklopci_dugovanja_avans').upsert({ kome: finalnoIme, iznos: novi })
      await supabase.from('poklopci_dugovanja_uplate').update({ kome: finalnoIme }).eq('kome', staro)
    }
    setShowPreimenuj(false)
    if (otvorenaOsoba === staro) setOtvorenaOsoba(finalnoIme)
    await Promise.all([ucitajRezervacije(), ucitajDugAvanse()])
    toast.success('Ime izmenjeno.')
  }

  async function resetKase() {
    if (resetCode !== '1234') { toast.error('Pogrešan kod.'); return }
    await supabase.from('poklopci_kasa').update({ stanje_zarada: 0 }).eq('id', 1)
    setStanjeKase(0); setShowResetKase(false); setResetCode('')
    toast.success('Kasa poklopci resetovana.')
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!username) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Učitavanje...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <DevicePhoneMobileIcon className="w-10 h-10 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">Zadnji poklopci</h1>
                <p className="text-slate-300 text-sm">Nezavisni modul · {username}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-sm font-medium">
                ← Glavni magacin
              </Link>
              <button onClick={logout} className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-sm">
                Odjavi se
              </button>
            </div>
          </div>
          <div className="px-6 py-4 flex flex-wrap gap-3 border-t border-slate-200 dark:border-gray-700">
            <button onClick={() => { setOtvorenaOsoba(null); setShowDugovanja(true) }}
              className="relative flex items-center gap-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg font-medium">
              <UserGroupIcon className="w-5 h-5" />
              Otvorena dugovanja
              {dugovanjaPoOsobi.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">{dugovanjaPoOsobi.length}</span>
              )}
            </button>
            <button onClick={() => setShowPregledProdaje(true)}
              className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg font-medium">
              <ChartBarIcon className="w-5 h-5" />
              Prodato: {ukupnoProdato.toFixed(2)} €
            </button>
            <button onClick={() => setShowResetKase(true)}
              className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm font-medium">
              Reset kase
            </button>
            <button onClick={otvoriDodavanje} className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold">
              <PlusIcon className="w-5 h-5" /> Novi model
            </button>
          </div>
        </div>

        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-slate-200 dark:border-gray-700 overflow-hidden">
          <button type="button" onClick={() => setShowInfoBar(v => !v)} className="w-full px-5 py-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-gray-700/50">
            <span className="font-medium text-slate-700 dark:text-slate-200">Pregled stanja poklopci</span>
            <ChevronDownIcon className={`w-5 h-5 transition ${showInfoBar ? 'rotate-180' : ''}`} />
          </button>
          {showInfoBar && (
            <div className="p-5 border-t grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-xs uppercase text-slate-500">Vrednost lagera</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{vrednostLagera.toFixed(2)} €</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4">
                <p className="text-xs uppercase text-emerald-600">Kasa poklopci</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stanjeKase.toFixed(2)} €</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
                <p className="text-xs uppercase text-blue-600">Ukupno prodato</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{ukupnoProdato.toFixed(2)} €</p>
                <p className="text-xs text-slate-500">{ukupnoKomadaProdato} kom</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4">
                <p className="text-xs uppercase text-amber-600">Na dugovanju</p>
                <p className="text-2xl font-bold text-amber-700">{ukupnoDugovanja.toFixed(2)} €</p>
                <p className="text-xs text-slate-500">{dugovanjaPoOsobi.length} osoba</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input value={pretraga} onChange={e => setPretraga(e.target.value)} placeholder="Pretraži model ili boju..."
              className="w-full pl-10 pr-4 py-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600" />
          </div>
          <select value={filterModel} onChange={e => setFilterModel(e.target.value)}
            className="px-4 py-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 min-w-[180px]">
            <option value="">Svi modeli</option>
            {modeli.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-slate-200 dark:border-gray-700 overflow-hidden">
          {grupePoModelu.length === 0 ? (
            <p className="p-10 text-center text-gray-500">Nema poklopaca. Klikni „Novi model” da dodaš prvi telefon i boju.</p>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {grupePoModelu.map(grupa => {
                const otvoren = jeOtvoren(grupa.model)
                return (
                  <div key={grupa.model} className={grupa.imaMalo ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}>
                    <div className="px-4 py-3 flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-gray-700/40 border-b border-slate-100 dark:border-gray-700">
                      <button type="button" onClick={() => toggleModel(grupa.model)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80">
                        <ChevronDownIcon className={`w-5 h-5 text-slate-500 shrink-0 transition ${otvoren ? 'rotate-180' : ''}`} />
                        <DevicePhoneMobileIcon className="w-7 h-7 text-slate-600 dark:text-slate-300 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-lg text-slate-800 dark:text-white">{grupa.model}</p>
                          <p className="text-sm text-slate-500">
                            {grupa.stavke.length} {grupa.stavke.length === 1 ? 'boja' : 'boje'} · {grupa.ukupnoKom} kom · {grupa.ukupnoVrednost.toFixed(2)} €
                          </p>
                        </div>
                      </button>
                      <button type="button" onClick={() => otvoriDodavanjeBoje(grupa.model)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shrink-0">
                        <PlusIcon className="w-4 h-4" /> Dodaj boju
                      </button>
                    </div>
                    {otvoren && (
                      <div className="divide-y dark:divide-gray-700/80">
                        {grupa.stavke.map(a => (
                          <div key={a.id} className={`pl-6 sm:pl-12 pr-4 py-3 flex flex-wrap items-center justify-between gap-3 ${a.kolicina <= 1 ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <SwatchIcon className="w-5 h-5 text-slate-400 shrink-0" />
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{a.boja}</p>
                                <p className="text-sm text-slate-500">
                                  Nabavna: {a.nabavna_cena.toFixed(2)} € · Prodajna: {a.prodajna_cena.toFixed(2)} €
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`text-lg font-bold ${a.kolicina <= 1 ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'}`}>{a.kolicina} kom</span>
                              <div className="flex gap-1">
                                <button onClick={() => otvoriProdaju(a)} title="Prodaj" className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><ShoppingBagIcon className="w-5 h-5" /></button>
                                <button onClick={() => otvoriRezervaciju(a)} title="Rezerviši" className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg"><ClockIcon className="w-5 h-5" /></button>
                                <button onClick={() => izmeniArtikal(a)} title="Izmeni" className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><PencilSquareIcon className="w-5 h-5" /></button>
                                <button onClick={() => obrisiArtikal(a.id)} title="Obriši" className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><TrashIcon className="w-5 h-5" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={sacuvajArtikal} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editId ? 'Izmeni boju' : formModelZakljucan && izabraniModel ? `Dodaj boju — ${izabraniModel}` : 'Novi model i boja'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)}><XMarkIcon className="w-6 h-6" /></button>
            </div>

            {formModelZakljucan && izabraniModel ? (
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-gray-700/60 rounded-xl px-4 py-3">
                <DevicePhoneMobileIcon className="w-8 h-8 text-slate-500" />
                <div>
                  <p className="text-xs uppercase text-slate-500">Model</p>
                  <p className="font-bold text-lg">{izabraniModel}</p>
                </div>
                {!editId && (
                  <button type="button" onClick={() => { setFormModelZakljucan(false); setIzabraniModel('') }}
                    className="ml-auto text-sm text-blue-600 hover:underline">Promeni model</button>
                )}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">1. Izaberi model telefona</label>
                <div className="flex gap-2 mt-1">
                  <select required value={izabraniModel} onChange={e => { setIzabraniModel(e.target.value); setIzabranaBoja('') }}
                    className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg bg-white text-slate-900 dark:bg-gray-700 dark:text-white dark:border-gray-500 cursor-pointer">
                    <option value="">— Izaberi model —</option>
                    {modeli.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNoviModel(true)} className="px-3 py-2 bg-slate-200 dark:bg-gray-600 rounded-lg text-sm whitespace-nowrap">+ Novi</button>
                </div>
              </div>
            )}

            {izabraniModel && (
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {formModelZakljucan ? '2. Izaberi boju za ovaj model' : '2. Izaberi boju'}
                </label>
                {postojeceBojeZaModel.length > 0 && !editId && (
                  <p className="text-xs text-slate-500 mt-1 mb-2">
                    Već imaš: {postojeceBojeZaModel.join(', ')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 mb-2 max-h-32 overflow-y-auto">
                  {dostupneBoje.map(b => (
                    <button key={b} type="button" onClick={() => setIzabranaBoja(b)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        izabranaBoja === b
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-gray-700 border-slate-300 dark:border-gray-600 hover:border-emerald-500'
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select required value={izabranaBoja} onChange={e => setIzabranaBoja(e.target.value)}
                    className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg bg-white text-slate-900 dark:bg-gray-700 dark:text-white dark:border-gray-500 cursor-pointer">
                    <option value="">— ili izaberi iz liste —</option>
                    {dostupneBoje.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNovaBoja(true)} className="px-3 py-2 bg-slate-200 dark:bg-gray-600 rounded-lg text-sm whitespace-nowrap">+ Nova</button>
                </div>
              </div>
            )}

            <input required type="number" min="0" placeholder="Količina" value={kolicina} onChange={e => setKolicina(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <input required type="number" step="0.01" placeholder="Nabavna cena €" value={nabavna} onChange={e => setNabavna(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <input required type="number" step="0.01" placeholder="Prodajna cena €" value={prodajna} onChange={e => setProdajna(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-60">{loading ? 'Čuvam...' : 'Sačuvaj'}</button>
          </form>
        </div>
      )}

      {showNoviModel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold">Dodaj novi model</h3>
            <input autoFocus placeholder="npr. iPhone 18 Pro" value={noviModelTekst} onChange={e => setNoviModelTekst(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <div className="flex gap-3">
              <button onClick={() => setShowNoviModel(false)} className="flex-1 py-2 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={dodajModel} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg">Dodaj</button>
            </div>
          </div>
        </div>
      )}

      {showNovaBoja && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold">Dodaj novu boju</h3>
            <input autoFocus placeholder="npr. Plava" value={novaBojaTekst} onChange={e => setNovaBojaTekst(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <div className="flex gap-3">
              <button onClick={() => setShowNovaBoja(false)} className="flex-1 py-2 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={dodajBoju} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg">Dodaj</button>
            </div>
          </div>
        </div>
      )}

      {showProdaja && prodajaArtikal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold">Prodaja — {labelArtikla(prodajaArtikal)}</h3>
            <p>Na stanju: {prodajaArtikal.kolicina}</p>
            <input type="number" min="1" max={prodajaArtikal.kolicina} value={prodajaKolicina} onChange={e => setProdajaKolicina(Number(e.target.value))} className="w-full px-4 py-3 border rounded-lg" />
            <input type="number" step="0.01" value={prodajaCena} onChange={e => setProdajaCena(Number(e.target.value))} className="w-full px-4 py-3 border rounded-lg" />
            <div className="flex gap-3">
              <button onClick={() => setShowProdaja(false)} className="flex-1 py-3 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={izvrsiProdaju} disabled={loading} className="flex-1 py-3 bg-green-600 text-white rounded-lg">Prodaj</button>
            </div>
          </div>
        </div>
      )}

      {showRezervacija && rezArtikal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold">Rezerviši — {labelArtikla(rezArtikal)}</h3>
            <p className="text-sm">Nabavna: <strong>{rezArtikal.nabavna_cena.toFixed(2)} €</strong> · Stanje: {rezArtikal.kolicina}</p>
            <input type="number" min="1" max={rezArtikal.kolicina} value={rezKolicina} onChange={e => setRezKolicina(Number(e.target.value))} className="w-full px-4 py-3 border rounded-lg" />
            <input list="poklopci-kome" required placeholder="Za koga / kome dao" value={rezKome} onChange={e => setRezKome(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
            <datalist id="poklopci-kome">{predloziZaRez.map(p => <option key={p.name} value={p.name} />)}</datalist>
            {predloziZaRez.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {predloziZaRez.slice(0, 10).map(p => (
                  <button key={p.name} type="button" onClick={() => setRezKome(p.name)}
                    className={`px-3 py-1 rounded-full text-sm ${rezKome === p.name ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <textarea rows={2} placeholder="Napomena" value={rezNapomena} onChange={e => setRezNapomena(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
            <div className="flex gap-3">
              <button onClick={() => setShowRezervacija(false)} className="flex-1 py-3 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={sacuvajRezervaciju} disabled={loading} className="flex-1 py-3 bg-orange-600 text-white rounded-lg">Rezerviši</button>
            </div>
          </div>
        </div>
      )}

      {showPregledProdaje && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-5 flex justify-between z-10">
              <div>
                <h3 className="text-xl font-bold text-blue-700 flex items-center gap-2"><ChartBarIcon className="w-6 h-6" /> Pregled prodaje</h3>
                <p className="text-sm text-gray-500">{ukupnoKomadaProdato} kom · ukupno {ukupnoProdato.toFixed(2)} €</p>
              </div>
              <button onClick={() => setShowPregledProdaje(false)}><XMarkIcon className="w-7 h-7" /></button>
            </div>
            <div className="p-5">
              {prodaje.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Još nema prodaja.</p>
              ) : (
                <div className="space-y-2">
                  {prodaje.map(p => (
                    <div key={p.id} className="border rounded-lg p-3 flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium">{labelArtikla(p.poklopci_artikli || {})}</p>
                        <p className="text-sm text-slate-500">{formatDatum(p.datum)} · {p.prodavac_username || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700">{p.ukupna_zarada.toFixed(2)} €</p>
                        <p className="text-sm text-slate-500">{p.kolicina_prodato} × {p.cena_po_komadu.toFixed(2)} €</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDugovanja && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-5 flex justify-between z-10">
              <div>
                <h3 className="text-xl font-bold text-amber-700 flex items-center gap-2"><UserGroupIcon className="w-6 h-6" /> Dugovanja poklopci</h3>
                <p className="text-sm text-gray-500">{dugovanjaPoOsobi.length} osoba · {ukupnoDugovanja.toFixed(2)} € (nabavna)</p>
              </div>
              <button onClick={() => setShowDugovanja(false)}><XMarkIcon className="w-7 h-7" /></button>
            </div>
            <div className="p-5">
              {!otvorenaOsoba ? (
                <div className="space-y-2">
                  {dugovanjaPoOsobi.length === 0 ? <p className="text-center py-8 text-gray-500">Nema dugovanja.</p> :
                    dugovanjaPoOsobi.map(o => (
                      <div key={o.kome} className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                        <button onClick={() => { setOtvorenaOsoba(o.kome); setIzabraneStavke(new Set()) }} className="flex-1 text-left font-bold">{o.kome}</button>
                        <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${badgeStarosti(o.dana)}`}>{o.dana}d</span>
                        <div className="text-right mr-3">
                          <span className="font-bold text-amber-700">{o.preostalo.toFixed(2)} €</span>
                          {o.avans > 0 && <p className="text-xs text-green-600">uplaćeno {o.avans.toFixed(2)} / {o.ukupno.toFixed(2)} €</p>}
                        </div>
                        <button onClick={() => { setPreimenujStaro(o.kome); setPreimenujNovo(o.kome); setShowPreimenuj(true) }} className="p-2 text-blue-600"><PencilSquareIcon className="w-5 h-5" /></button>
                        <button onClick={() => { setOtvorenaOsoba(o.kome); setIzabraneStavke(new Set()) }}><ChevronRightIcon className="w-5 h-5" /></button>
                      </div>
                    ))}
                </div>
              ) : osobaDetalj && (
                <div>
                  <button onClick={() => setOtvorenaOsoba(null)} className="text-sm text-amber-700 mb-3">← Nazad</button>
                  <div className="mb-4">
                    <h4 className="text-lg font-bold">{osobaDetalj.kome}</h4>
                    <p className="text-2xl font-extrabold text-amber-700">{osobaDetalj.preostalo.toFixed(2)} € preostalo</p>
                    {osobaDetalj.avans > 0 && (
                      <p className="text-sm text-green-600">Stavke: {osobaDetalj.ukupno.toFixed(2)} € · Uplaćeno: {osobaDetalj.avans.toFixed(2)} €</p>
                    )}
                  </div>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <button type="button" onClick={() => { setDelimicnoIznos(''); setDelimicnoNapomena(''); setShowDelimicnoPlacanje(true) }}
                      disabled={loading || osobaDetalj.preostalo <= 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Delimično plaćanje</button>
                    <button onClick={() => razduziStavke(osobaDetalj.stavke, true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
                      Plati sve ({osobaDetalj.preostalo.toFixed(2)} €)
                    </button>
                    <button onClick={() => razduziStavke(osobaDetalj.stavke.filter(s => izabraneStavke.has(s.id)), true)} disabled={izabraneStavke.size === 0} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm disabled:opacity-50">Plati izabrano</button>
                  </div>
                  {osobaDetalj.stavke.map(rez => (
                    <div key={rez.id} className="border rounded-lg p-3 mb-2 flex gap-3 items-start flex-wrap">
                      <input type="checkbox" checked={izabraneStavke.has(rez.id)} onChange={() => setIzabraneStavke(prev => { const n = new Set(prev); n.has(rez.id) ? n.delete(rez.id) : n.add(rez.id); return n })} />
                      <div className="flex-1 min-w-[140px]">
                        <p className="font-medium">{labelArtikla(rez.poklopci_artikli || {})}</p>
                        <p className="text-sm">{rez.kolicina} × {cenaStavke(rez).toFixed(2)} € = <strong>{(rez.kolicina * cenaStavke(rez)).toFixed(2)} €</strong></p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button type="button" onClick={() => otvoriIzmenuStavke(rez)} className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 rounded flex items-center gap-1">
                          <PencilSquareIcon className="w-4 h-4" /> Izmeni
                        </button>
                        <button onClick={() => razduziStavke([rez], true)} className="text-sm px-3 py-1 bg-green-600 text-white rounded">Plaćeno</button>
                        <button onClick={() => razduziStavke([rez], false)} className="text-sm px-3 py-1 bg-orange-600 text-white rounded">Vrati</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDelimicnoPlacanje && osobaDetalj && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-blue-600">Delimično plaćanje</h3>
              <button onClick={() => setShowDelimicnoPlacanje(false)}><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <p className="text-sm text-slate-500">{osobaDetalj.kome} · preostalo: <strong>{osobaDetalj.preostalo.toFixed(2)} €</strong></p>
            <input type="number" step="0.01" min="0.01" max={osobaDetalj.preostalo} placeholder="Iznos €" value={delimicnoIznos}
              onChange={e => setDelimicnoIznos(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" autoFocus />
            <textarea rows={2} placeholder="Napomena" value={delimicnoNapomena} onChange={e => setDelimicnoNapomena(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <div className="flex gap-3">
              <button onClick={() => setShowDelimicnoPlacanje(false)} className="flex-1 py-2 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={evidentirajDelimicnoPlacanje} disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60">
                {loading ? 'Čuvam...' : 'Evidentiraj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIzmenaStavke && izmenaStavkaRez && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-blue-600">Izmeni stavku</h3>
              <button onClick={() => setShowIzmenaStavke(false)}><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <p className="font-medium">{labelArtikla(izmenaStavkaRez.poklopci_artikli || {})}</p>
            <p className="text-sm text-slate-500">Za: {izmenaStavkaRez.kome}</p>
            <div>
              <label className="text-sm text-slate-600">Količina</label>
              <input type="number" min="1" value={izmenaKolicina} onChange={e => setIzmenaKolicina(Number(e.target.value))}
                className="w-full mt-1 px-4 py-3 border rounded-lg dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-sm text-slate-600">Cena po komadu (€)</label>
              <input type="number" step="0.01" min="0.01" value={izmenaCena} onChange={e => setIzmenaCena(Number(e.target.value))}
                className="w-full mt-1 px-4 py-3 border rounded-lg dark:bg-gray-700" />
            </div>
            <p className="text-sm bg-slate-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
              Ukupno: <strong>{(Number(izmenaKolicina) * Number(izmenaCena)).toFixed(2)} €</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowIzmenaStavke(false)} className="flex-1 py-2 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={sacuvajIzmenuStavke} disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60">
                {loading ? 'Čuvam...' : 'Sačuvaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreimenuj && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold">Izmeni / spoji ime</h3>
            <input value={preimenujNovo} onChange={e => setPreimenujNovo(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
            <div className="flex gap-3">
              <button onClick={() => setShowPreimenuj(false)} className="flex-1 py-2 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={sacuvajPreimenovanje} className="flex-1 py-2 bg-blue-600 text-white rounded-lg">Sačuvaj</button>
            </div>
          </div>
        </div>
      )}

      {showResetKase && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold text-red-600">Reset kase poklopci</h3>
            <p className="text-sm text-slate-500">Kasa se vraća na 0 €. Istorija prodaje ostaje sačuvana.</p>
            <input type="password" placeholder="Unesi kod" value={resetCode} onChange={e => setResetCode(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
            <div className="flex gap-3">
              <button onClick={() => setShowResetKase(false)} className="flex-1 py-2 bg-gray-200 rounded-lg">Otkaži</button>
              <button onClick={resetKase} className="flex-1 py-2 bg-red-600 text-white rounded-lg">Resetuj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
