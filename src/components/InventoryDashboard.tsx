'use client'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CurrencyEuroIcon,
  CubeIcon,
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DevicePhoneMobileIcon,
  Battery100Icon,
  UserIcon,
  UserGroupIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'

type Uloga = 'admin' | 'kolega' | 'serviser' | 'lager'
type Profile = { username: string; uloga: Uloga; active?: boolean }

type OsobaDugovanje = {
  kome: string
  stavke: any[]
  ukupno: number
  avans: number
  preostalo: number
  dana: number
}

type DugAvans = { kome: string; iznos: number }

function prikaziNapomenu(napomena: string | null): string {
  if (!napomena) return ''
  if (napomena.startsWith('[dug]')) return napomena.slice(5).trim()
  if (napomena.startsWith('[rez]')) return napomena.slice(5).trim()
  return napomena
}

function danaOd(datum: string): number {
  return Math.floor((Date.now() - new Date(datum).getTime()) / (1000 * 60 * 60 * 24))
}

function bojaStarosti(dana: number): string {
  if (dana >= 7) return 'text-red-600 dark:text-red-400'
  if (dana >= 3) return 'text-orange-600 dark:text-orange-400'
  return 'text-green-600 dark:text-green-400'
}

function badgeStarosti(dana: number): string {
  if (dana >= 7) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (dana >= 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
}

/** Ulazna cena artikla (trošak); ako nije uneta, fallback na osnovnu. */
function ulaznaArtikla(art: { ulazna_cena?: number; osnovna_cena?: number }): number {
  const ulazna = Number(art.ulazna_cena ?? 0)
  if (ulazna > 0) return ulazna
  return Number(art.osnovna_cena ?? 0)
}

/** Prosečna ponderisana ulazna: (staro×cena + novo×cena) / ukupno kom */
function prosecanNabavna(
  staraKolicina: number,
  staraCena: number,
  dolaziKolicina: number,
  dolaziCena: number,
): number {
  const ukupno = staraKolicina + dolaziKolicina
  if (ukupno <= 0) return dolaziCena
  if (staraKolicina <= 0) return dolaziCena
  return (staraKolicina * staraCena + dolaziKolicina * dolaziCena) / ukupno
}

const ulogaNaziv: Record<Uloga, string> = {
  admin: 'Admin',
  kolega: 'Kolega',
  serviser: 'Serviser',
  lager: 'Lager',
}

export default function InventoryDashboard({ initialEditId }: { initialEditId?: string | null }) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<{ username: string; uloga: Uloga } | null>(null)
  const [artikli, setArtikli] = useState<any[]>([])
  const [rezervacije, setRezervacije] = useState<any[]>([])
  const [pretraga, setPretraga] = useState('')
  const [debouncedPretraga, setDebouncedPretraga] = useState('')
  const [filterKategorija, setFilterKategorija] = useState('')
  const [stanjeKase, setStanjeKase] = useState(0)
  const [novacULageru, setNovacULageru] = useState(0)
  const [loading, setLoading] = useState(false)

  const [kriticniFilter, setKriticniFilter] = useState<'all' | 'zero' | 'one' | 'two' | 'lte1' | 'lte2' | 'gt2'>('lte1')

  // Forma za artikal
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [naziv, setNaziv] = useState('')
  const [osnovna, setOsnovna] = useState('')
  const [serviser, setServiser] = useState('')
  const [kolega, setKolega] = useState('')
  const [kolicina, setKolicina] = useState('')
  const [kategorija, setKategorija] = useState('')
  const [ulazna, setUlazna] = useState('')

  // Prodaja
  const [showProdaja, setShowProdaja] = useState(false)
  const [prodajaArtikal, setProdajaArtikal] = useState<any | null>(null)
  const [prodajaKolicina, setProdajaKolicina] = useState(1)
  const [prodajaCena, setProdajaCena] = useState(0)

  // Rezervacija
  const [showRezervacija, setShowRezervacija] = useState(false)
  const [rezArtikal, setRezArtikal] = useState<any | null>(null)
  const [rezKolicina, setRezKolicina] = useState(1)
  const [rezKome, setRezKome] = useState('')
  const [rezNapomena, setRezNapomena] = useState('')

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [dugovanjaTab, setDugovanjaTab] = useState<'osobe' | 'sve'>('osobe')
  const [otvorenaOsoba, setOtvorenaOsoba] = useState<string | null>(null)
  const [izabraneStavke, setIzabraneStavke] = useState<Set<string>>(new Set())
  const [showPreimenujModal, setShowPreimenujModal] = useState(false)
  const [preimenujStaroIme, setPreimenujStaroIme] = useState('')
  const [preimenujNovoIme, setPreimenujNovoIme] = useState('')

  const [dugAvansi, setDugAvansi] = useState<DugAvans[]>([])
  const [showDelimicnoPlacanje, setShowDelimicnoPlacanje] = useState(false)
  const [delimicnoIznos, setDelimicnoIznos] = useState('')
  const [delimicnoNapomena, setDelimicnoNapomena] = useState('')
  const [showIzmenaStavke, setShowIzmenaStavke] = useState(false)
  const [izmenaStavkaRez, setIzmenaStavkaRez] = useState<any | null>(null)
  const [izmenaKolicina, setIzmenaKolicina] = useState(1)
  const [izmenaCena, setIzmenaCena] = useState(0)

  // Reset kase
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetCode, setResetCode] = useState('')

  // Ostali modalni prozori
  const [showKriticniModal, setShowKriticniModal] = useState(false)
  const [showRezervisaniModal, setShowRezervisaniModal] = useState(false)
  const [showVrednostPoKategorijama, setShowVrednostPoKategorijama] = useState(false)
  const [showInfoBar, setShowInfoBar] = useState(false)

  const [showPrijem, setShowPrijem] = useState(false)
  const [showPrijemiHistoria, setShowPrijemiHistoria] = useState(false)
  const [prijemi, setPrijemi] = useState<any[]>([])
  const [prijemArtikal, setPrijemArtikal] = useState<any | null>(null)
  const [prijemKolicina, setPrijemKolicina] = useState('')
  const [prijemCena, setPrijemCena] = useState('')
  const [prijemDobavljac, setPrijemDobavljac] = useState('')
  const [prijemDatum, setPrijemDatum] = useState(() => new Date().toISOString().slice(0, 10))
  const [prijemNapomena, setPrijemNapomena] = useState('')
  const [prijemAzurirajCenu, setPrijemAzurirajCenu] = useState(true)

  // Paginacija
  const [page, setPage] = useState(1)
  const perPage = 30

  const kategorije = [
    'SAMSUNG LCD',
    'IPHONE LCD KOPIJA',
    'IPHONE LCD ORG',
    'HUAWEI LCD',
    'BATERIJE IPHONE',
    'BATERIJE VERIFY',
    'SAMSUNG BATERIJE',
    'Ostalo',
  ]

  const skrivenoZaOstale = ['BATERIJE IPHONE', 'BATERIJE VERIFY']

  const ulogaBoja: Record<Uloga, string> = {
    admin: 'bg-indigo-600',
    kolega: 'bg-green-600',
    serviser: 'bg-orange-600',
    lager: 'bg-gray-600',
  }

  // ---------- Data fetching & normalization ----------
  async function getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) console.error('Supabase getUser error:', error)
      const user = data?.user
      if (!user) {
        await router.push('/login')
        return
      }
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('username, uloga, active')
        .eq('id', user.id)
        .single()
      if (profileErr || !profile) {
        console.error('Error fetching profile:', profileErr)
        await supabase.auth.signOut()
        await router.push('/login')
        return
      }
      if (profile.active === false) {
        await supabase.auth.signOut()
        toast.error('Nalog je deaktiviran.')
        await router.push('/login')
        return
      }
      setCurrentUser(profile as { username: string; uloga: Uloga })
    } catch (err) {
      console.error('Unexpected error in getCurrentUser:', err)
      toast.error('Greška pri učitavanju korisnika')
    }
  }

  async function ucitajArtikle() {
    try {
      const { data, error } = await supabase.from('artikli').select('*').order('naziv', { ascending: true })
      if (error) {
        console.error('Error fetching artikli:', error)
        toast.error('Greška pri učitavanju artikala')
        setArtikli([])
        setNovacULageru(0)
        return
      }
      const normalized = (data || []).map((a: any) => ({
        ...a,
        kolicina: Number(a.kolicina ?? 0),
        osnovna_cena: Number(a.osnovna_cena ?? 0),
        cena_serviser: Number(a.cena_serviser ?? 0),
        cena_kolega: Number(a.cena_kolega ?? 0),
        ulazna_cena: Number(a.ulazna_cena ?? 0),
      }))
      setArtikli(normalized)
      const lager = normalized.reduce((sum: number, it: any) => sum + ulaznaArtikla(it) * (it.kolicina || 0), 0)
      setNovacULageru(lager)
    } catch (err) {
      console.error('Unexpected error loading artikli:', err)
      toast.error('Neočekivana greška pri učitavanju artikala')
    }
  }

  async function ucitajKasu() {
    try {
      const { data, error } = await supabase.from('kasa').select('stanje_zarada').eq('id', 1).single()
      if (error) {
        console.error('Error fetching kasa:', error)
        toast.error('Greška pri učitavanju kase')
        setStanjeKase(0)
        return
      }
      setStanjeKase(Number(data?.stanje_zarada ?? 0))
    } catch (err) {
      console.error('Unexpected error loading kasa:', err)
      toast.error('Greška pri učitavanju kase')
    }
  }

  async function ucitajProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, uloga, active')
        .order('username', { ascending: true })
      if (error) {
        console.error('Error fetching profiles:', error)
        toast.error('Greška pri učitavanju liste korisnika.')
        return
      }
      setProfiles((data || []) as Profile[])
    } catch (err) {
      console.error('Unexpected error loading profiles:', err)
    }
  }

  async function ucitajDugAvanse() {
    try {
      const { data, error } = await supabase.from('dugovanja_avans').select('kome, iznos')
      if (error) {
        setDugAvansi([])
        return
      }
      setDugAvansi((data || []).map(r => ({ kome: r.kome, iznos: Number(r.iznos ?? 0) })))
    } catch {
      setDugAvansi([])
    }
  }

  async function ucitajRezervacije() {
    try {
      const { data, error } = await supabase
        .from('rezervacije')
        .select('*, artikli(naziv, osnovna_cena, cena_kolega, cena_serviser, kolicina)')
        .eq('razduzeno', false)
        .order('datum_rezervacije', { ascending: false })
      if (error) {
        console.error('Error fetching rezervacije:', error)
        toast.error('Greška pri učitavanju rezervacija')
        setRezervacije([])
        return
      }
      setRezervacije(data || [])
    } catch (err) {
      console.error('Unexpected error loading rezervacije:', err)
      toast.error('Greška pri učitavanju rezervacija')
    }
  }

  // ---------- Effects ----------
  useEffect(() => {
    getCurrentUser()
    ucitajArtikle()
  }, [])

  useEffect(() => {
    if (!currentUser) return
    ucitajKasu().catch(err => toast.error('Greška pri učitavanju kase'))
    if (currentUser.uloga === 'admin') {
      ucitajRezervacije().catch(err => toast.error('Greška pri učitavanju rezervacija'))
      ucitajDugAvanse()
      ucitajPrijeme()
      ucitajProfile()
    }
  }, [currentUser])

  async function ucitajPrijeme() {
    try {
      const { data, error } = await supabase
        .from('prijemi')
        .select('*, artikli(naziv, kategorija)')
        .order('datum', { ascending: false })
        .limit(100)
      if (error) { setPrijemi([]); return }
      setPrijemi(data || [])
    } catch {
      setPrijemi([])
    }
  }

  function otvoriPrijem(art?: any) {
    setPrijemArtikal(art || null)
    setPrijemKolicina('')
    setPrijemCena(art ? String(ulaznaArtikla(art) || '') : '')
    setPrijemDobavljac('')
    setPrijemDatum(new Date().toISOString().slice(0, 10))
    setPrijemNapomena('')
    setPrijemAzurirajCenu(true)
    setShowPrijem(true)
  }

  async function sacuvajPrijem(e: React.FormEvent) {
    e.preventDefault()
    if (!prijemArtikal) { toast.error('Izaberi artikal.'); return }
    const kol = Math.floor(Number(prijemKolicina))
    const cena = Number(prijemCena)
    if (kol <= 0 || cena < 0) { toast.error('Proveri količinu i cenu.'); return }
    setLoading(true)
    try {
      const staraKolicina = Number(prijemArtikal.kolicina ?? 0)
      const staraCena = ulaznaArtikla(prijemArtikal)
      const novaKolicina = staraKolicina + kol
      const artikalUpdate: Record<string, unknown> = { kolicina: novaKolicina }
      let novaProsecna = staraCena
      if (prijemAzurirajCenu) {
        novaProsecna = prosecanNabavna(staraKolicina, staraCena, kol, cena)
        artikalUpdate.ulazna_cena = novaProsecna
      }
      const datumIso = prijemDatum ? new Date(prijemDatum + 'T12:00:00').toISOString() : new Date().toISOString()
      const [ins, upd] = await Promise.all([
        supabase.from('prijemi').insert({
          artikal_id: prijemArtikal.id,
          kolicina: kol,
          cena_po_komadu: cena,
          dobavljac: prijemDobavljac.trim() || null,
          napomena: prijemNapomena.trim() || null,
          uneto_od: currentUser?.username,
          datum: datumIso,
        }),
        supabase.from('artikli').update(artikalUpdate).eq('id', prijemArtikal.id),
      ])
      if (ins.error) {
        toast.error(ins.error.message.includes('prijemi')
          ? 'Pokreni magacin_prijem_upgrade.sql u Supabase.'
          : 'Greška pri prijemu.')
        setLoading(false)
        return
      }
      if (upd.error) { toast.error('Greška pri ažuriranju lagera.'); setLoading(false); return }
      const cenaPoruka = prijemAzurirajCenu && staraKolicina > 0
        ? ` · prosečna ulazna: ${staraCena.toFixed(2)} → ${novaProsecna.toFixed(2)} €`
        : prijemAzurirajCenu
          ? ` · ulazna: ${novaProsecna.toFixed(2)} €`
          : ''
      toast.success(`Prijem: +${kol} kom → ${novaKolicina} na stanju${cenaPoruka}`)
      setShowPrijem(false)
      await Promise.all([ucitajArtikle(), ucitajPrijeme()])
    } catch {
      toast.error('Greška pri prijemu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentUser || currentUser.uloga !== 'admin') return
    const channel = supabase
      .channel('rezervacije-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rezervacije' }, () => {
        ucitajRezervacije()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentUser])

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedPretraga(pretraga.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [pretraga])

  useEffect(() => {
    if (!initialEditId || !currentUser || currentUser.uloga !== 'admin' || artikli.length === 0) return
    const art = artikli.find(a => a.id === initialEditId)
    if (art) {
      izmeniArtikal(art)
      window.history.replaceState({}, '', '/')
    }
  }, [initialEditId, artikli, currentUser])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showPrijem) { setShowPrijem(false); return }
      if (showPrijemiHistoria) { setShowPrijemiHistoria(false); return }
      if (showIzmenaStavke) {
        setShowIzmenaStavke(false)
        return
      }
      if (showDelimicnoPlacanje) {
        setShowDelimicnoPlacanje(false)
        return
      }
      if (showPreimenujModal) {
        setShowPreimenujModal(false)
        return
      }
      if (showResetConfirm) {
        setShowResetConfirm(false)
        setResetCode('')
        return
      }
      if (showVrednostPoKategorijama) {
        setShowVrednostPoKategorijama(false)
        return
      }
      if (showRezervisaniModal) {
        if (otvorenaOsoba) {
          setOtvorenaOsoba(null)
          setIzabraneStavke(new Set())
        } else {
          setShowRezervisaniModal(false)
        }
        return
      }
      if (showKriticniModal) {
        setShowKriticniModal(false)
        return
      }
      if (showForm) {
        setShowForm(false)
        setEditId(null)
        resetForme()
        return
      }
      if (showProdaja) {
        setShowProdaja(false)
        return
      }
      if (showRezervacija) {
        setShowRezervacija(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    showPrijem,
    showPrijemiHistoria,
    showIzmenaStavke,
    showDelimicnoPlacanje,
    showPreimenujModal,
    showResetConfirm,
    showVrednostPoKategorijama,
    showRezervisaniModal,
    otvorenaOsoba,
    showKriticniModal,
    showForm,
    showProdaja,
    showRezervacija,
  ])

  // ---------- Actions ----------
  function otvoriProdaju(artikal: any) {
    setProdajaArtikal(artikal)
    setProdajaKolicina(1)
    setProdajaCena(artikal.osnovna_cena ?? 0)
    setShowProdaja(true)
  }

  async function izvrsiProdaju() {
    setLoading(true)
    try {
      if (!prodajaArtikal || prodajaKolicina <= 0 || prodajaKolicina > prodajaArtikal.kolicina || prodajaCena <= 0) {
        toast.error('Nevalidna količina ili cena!')
        setLoading(false)
        return
      }
      const zarada = prodajaCena * prodajaKolicina
      const [updRes, insertRes, kasaRes] = await Promise.all([
        supabase.from('artikli').update({ kolicina: prodajaArtikal.kolicina - prodajaKolicina }).eq('id', prodajaArtikal.id),
        supabase.from('prodaje').insert({
          artikal_id: prodajaArtikal.id,
          kolicina_prodato: prodajaKolicina,
          cena_po_komadu: prodajaCena,
          ukupna_zarada: zarada,
          prodavac_username: currentUser?.username,
          uloga_prodavac: currentUser?.uloga,
        }),
        supabase.from('kasa').update({ stanje_zarada: stanjeKase + zarada }).eq('id', 1),
      ])
      if ((updRes as any).error || (insertRes as any).error || (kasaRes as any).error) {
        toast.error('Greška pri upisu podataka (prodaja).')
        setLoading(false)
        return
      }
      setArtikli(prev => prev.map(a => a.id === prodajaArtikal.id ? { ...a, kolicina: a.kolicina - prodajaKolicina } : a))
      setStanjeKase(prev => prev + zarada)
      await ucitajArtikle()
      await ucitajKasu()
      await ucitajRezervacije()
      toast.success(`Prodato ${prodajaKolicina} × ${prodajaArtikal.naziv} — Zarada: ${zarada.toFixed(2)} €`)
    } catch (err) {
      toast.error('Greška pri prodaji!')
    } finally {
      setLoading(false)
      setShowProdaja(false)
    }
  }

  function otvoriRezervaciju(artikal: any) {
    setRezArtikal(artikal)
    setRezKolicina(1)
    setRezKome('')
    setRezNapomena('')
    setShowRezervacija(true)
  }

  function otvoriDugovanjaModal() {
    setDugovanjaTab('osobe')
    setOtvorenaOsoba(null)
    setIzabraneStavke(new Set())
    setShowRezervisaniModal(true)
  }

  function otvoriPreimenujModal(ime: string) {
    setPreimenujStaroIme(ime)
    setPreimenujNovoIme(ime)
    setShowPreimenujModal(true)
  }

  async function sacuvajPreimenovanje() {
    const staro = preimenujStaroIme.trim()
    const novo = preimenujNovoIme.trim()
    if (!staro || !novo) {
      toast.error('Unesi ime.')
      return
    }
    if (staro.toLowerCase() === novo.toLowerCase()) {
      toast.error('Novo ime je isto kao staro.')
      return
    }

    const stavkeZaUpdate = rezervacije.filter(r => r.kome === staro)
    if (stavkeZaUpdate.length === 0) {
      toast.error('Nema stavki za ovu osobu.')
      return
    }

    const cilj = dugovanjaPoOsobi.find(o => o.kome.toLowerCase() === novo.toLowerCase() && o.kome !== staro)
    const poruka = cilj
      ? `Spojiti "${staro}" (${stavkeZaUpdate.length}) sa "${cilj.kome}" (${cilj.stavke.length})?`
      : `Preimenovati "${staro}" u "${novo}"? (${stavkeZaUpdate.length} stavki)`

    if (!confirm(poruka)) return

    setLoading(true)
    try {
      const ids = stavkeZaUpdate.map(r => r.id)
      const { error } = await supabase
        .from('rezervacije')
        .update({ kome: cilj ? cilj.kome : novo })
        .in('id', ids)

      if (error) {
        toast.error('Greška pri izmeni imena.')
        setLoading(false)
        return
      }

      const finalnoIme = cilj ? cilj.kome : novo
      const avansStaro = avansZaOsobu(staro)
      if (avansStaro > 0) {
        const avansCilj = cilj ? avansZaOsobu(cilj.kome) : 0
        await supabase.from('dugovanja_avans').delete().eq('kome', staro)
        if (cilj) {
          const novi = avansStaro + avansCilj
          if (novi > 0) await supabase.from('dugovanja_avans').upsert({ kome: finalnoIme, iznos: novi })
        } else {
          await supabase.from('dugovanja_avans').upsert({ kome: finalnoIme, iznos: avansStaro })
        }
        await supabase.from('dugovanja_uplate').update({ kome: finalnoIme }).eq('kome', staro)
      }
      await ucitajRezervacije()
      await ucitajDugAvanse()
      if (otvorenaOsoba === staro) setOtvorenaOsoba(finalnoIme)
      setShowPreimenujModal(false)
      toast.success(cilj ? `Spojeno sa "${finalnoIme}"` : `Ime izmenjeno u "${finalnoIme}"`)
    } catch {
      toast.error('Greška pri izmeni imena!')
    } finally {
      setLoading(false)
    }
  }

  function toggleStavka(id: string) {
    setIzabraneStavke(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function avansZaOsobu(kome: string): number {
    return Number(dugAvansi.find(a => a.kome === kome)?.iznos ?? 0)
  }

  function izracunajCenuStavke(rez: any): number {
    if (rez.cena_po_komadu != null && rez.cena_po_komadu !== '') {
      return Number(rez.cena_po_komadu)
    }
    const artikal = rez.artikli || artikli.find(a => a.id === rez.artikal_id)
    return Number(artikal?.osnovna_cena ?? 0)
  }

  function otvoriIzmenuStavke(rez: any) {
    setIzmenaStavkaRez(rez)
    setIzmenaKolicina(rez.kolicina)
    setIzmenaCena(izracunajCenuStavke(rez))
    setShowIzmenaStavke(true)
  }

  async function sacuvajIzmenuStavke() {
    if (!izmenaStavkaRez) return
    const novaKol = Math.floor(Number(izmenaKolicina))
    const novaCena = Number(izmenaCena)
    if (novaKol <= 0 || novaCena <= 0) {
      toast.error('Količina i cena moraju biti veći od 0.')
      return
    }
    setLoading(true)
    try {
      const rez = izmenaStavkaRez
      const diff = novaKol - rez.kolicina
      const art = artikli.find(a => a.id === rez.artikal_id)
      if (diff > 0) {
        const naStanju = Number(art?.kolicina ?? 0)
        if (naStanju < diff) {
          toast.error(`Nema dovoljno na stanju (slobodno ${naStanju} kom).`)
          setLoading(false)
          return
        }
        const { error } = await supabase.from('artikli').update({ kolicina: naStanju - diff }).eq('id', rez.artikal_id)
        if (error) { toast.error('Greška pri skidanju sa lagera.'); setLoading(false); return }
      } else if (diff < 0) {
        const { error } = await supabase.from('artikli').update({ kolicina: Number(art?.kolicina ?? 0) + (-diff) }).eq('id', rez.artikal_id)
        if (error) { toast.error('Greška pri vraćanju na lager.'); setLoading(false); return }
      }
      const { error } = await supabase.from('rezervacije').update({
        kolicina: novaKol,
        cena_po_komadu: novaCena,
      }).eq('id', rez.id)
      if (error) {
        toast.error(error.message.includes('cena_po_komadu')
          ? 'Pokreni magacin_dugovanja_upgrade.sql u Supabase.'
          : 'Greška pri čuvanju stavke.')
        setLoading(false)
        return
      }
      setShowIzmenaStavke(false)
      toast.success('Stavka izmenjena.')
      await Promise.all([ucitajRezervacije(), ucitajArtikle()])
    } catch {
      toast.error('Greška pri izmeni stavke.')
    } finally {
      setLoading(false)
    }
  }

  async function evidentirajDelimicnoPlacanje() {
    if (!otvorenaOsoba || !osobaDetalj) return
    const iznos = Number(delimicnoIznos)
    if (!iznos || iznos <= 0) {
      toast.error('Unesi iznos uplate.')
      return
    }
    if (iznos > osobaDetalj.preostalo + 0.005) {
      toast.error(`Maksimum je ${osobaDetalj.preostalo.toFixed(2)} € (preostali dug).`)
      return
    }
    setLoading(true)
    try {
      const noviAvans = avansZaOsobu(otvorenaOsoba) + iznos
      const [avRes, uplRes, kasRes] = await Promise.all([
        supabase.from('dugovanja_avans').upsert({ kome: otvorenaOsoba, iznos: noviAvans }),
        supabase.from('dugovanja_uplate').insert({
          kome: otvorenaOsoba,
          iznos,
          napomena: delimicnoNapomena.trim() || null,
          uneto_od: currentUser?.username,
        }),
        supabase.from('kasa').update({ stanje_zarada: stanjeKase + iznos }).eq('id', 1),
      ])
      if (avRes.error || uplRes.error || kasRes.error) {
        toast.error('Greška — pokreni magacin_dugovanja_upgrade.sql u Supabase.')
        setLoading(false)
        return
      }
      setStanjeKase(prev => prev + iznos)
      setShowDelimicnoPlacanje(false)
      setDelimicnoIznos('')
      setDelimicnoNapomena('')
      await ucitajDugAvanse()
      await ucitajKasu()
      toast.success(`Uplaćeno ${iznos.toFixed(2)} €. Preostalo: ${(osobaDetalj.preostalo - iznos).toFixed(2)} €`)
    } catch {
      toast.error('Greška pri delimičnom plaćanju.')
    } finally {
      setLoading(false)
    }
  }

  async function sacuvajRezervaciju() {
    setLoading(true)
    try {
      const kome = rezKome.trim()
      if (!rezArtikal || rezKolicina <= 0 || rezKolicina > rezArtikal.kolicina || !kome) {
        toast.error('Proveri podatke!')
        setLoading(false)
        return
      }
      const [updRes, insertRes] = await Promise.all([
        supabase.from('artikli').update({ kolicina: rezArtikal.kolicina - rezKolicina }).eq('id', rezArtikal.id),
        supabase.from('rezervacije').insert({
          artikal_id: rezArtikal.id,
          kolicina: rezKolicina,
          kome,
          napomena: rezNapomena.trim() || null,
        }),
      ])
      if ((updRes as any).error || (insertRes as any).error) {
        toast.error('Greška pri rezervaciji.')
        setLoading(false)
        return
      }
      setArtikli(prev => prev.map(a => a.id === rezArtikal.id ? { ...a, kolicina: a.kolicina - rezKolicina } : a))
      await ucitajRezervacije()
      await ucitajArtikle()
      toast.success(`Rezervisano ${rezKolicina} × ${rezArtikal.naziv} za "${kome}"`)
    } catch (err) {
      toast.error('Greška pri rezervaciji!')
    } finally {
      setLoading(false)
      setShowRezervacija(false)
    }
  }

  async function razduziStavke(stavke: any[], placeno: boolean) {
    if (stavke.length === 0) {
      toast.error('Nema izabranih stavki.')
      return
    }
    setLoading(true)
    try {
      let trenutnaKasa = stanjeKase
      const kome = stavke[0]?.kome
      const stavkeTotal = stavke.reduce((s, r) => s + izracunajCenuStavke(r) * r.kolicina, 0)
      const avans = placeno && kome ? avansZaOsobu(kome) : 0
      const saAvansa = Math.min(avans, stavkeTotal)
      const naKasu = stavkeTotal - saAvansa

      for (const rez of stavke) {
        const cena = izracunajCenuStavke(rez)
        const zarada = cena * rez.kolicina

        if (placeno) {
          const prodajaRes = await supabase.from('prodaje').insert({
            artikal_id: rez.artikal_id,
            kolicina_prodato: rez.kolicina,
            cena_po_komadu: cena,
            ukupna_zarada: zarada,
            prodavac_username: currentUser?.username,
            uloga_prodavac: currentUser?.uloga,
          })
          if ((prodajaRes as any).error) {
            toast.error('Greška pri razduženju (plaćeno).')
            setLoading(false)
            return
          }
        } else {
          const art = artikli.find(a => a.id === rez.artikal_id)
          if (art) {
            const upd = await supabase.from('artikli').update({ kolicina: art.kolicina + rez.kolicina }).eq('id', rez.artikal_id)
            if ((upd as any).error) {
              toast.error('Greška pri vraćanju na lager.')
              setLoading(false)
              return
            }
          }
        }

        const updRez = await supabase.from('rezervacije').update({ razduzeno: true }).eq('id', rez.id)
        if ((updRez as any).error) {
          toast.error('Greška pri zatvaranju stavke.')
          setLoading(false)
          return
        }
      }

      if (placeno) {
        if (naKasu > 0) {
          const kasaRes = await supabase.from('kasa').update({ stanje_zarada: trenutnaKasa + naKasu }).eq('id', 1)
          if ((kasaRes as any).error) {
            toast.error('Greška pri ažuriranju kase.')
            setLoading(false)
            return
          }
          trenutnaKasa += naKasu
        }
        if (saAvansa > 0 && kome) {
          const noviAvans = avans - saAvansa
          if (noviAvans <= 0.005) {
            await supabase.from('dugovanja_avans').delete().eq('kome', kome)
          } else {
            await supabase.from('dugovanja_avans').upsert({ kome, iznos: noviAvans })
          }
        }
      }

      setStanjeKase(trenutnaKasa)
      await ucitajRezervacije()
      await ucitajArtikle()
      await ucitajKasu()
      await ucitajDugAvanse()
      setIzabraneStavke(new Set())

      if (placeno) {
        const poruka = saAvansa > 0
          ? `Plaćeno ${stavke.length} stavki — ${naKasu.toFixed(2)} € na kasu (${saAvansa.toFixed(2)} € iz avansa)`
          : `Plaćeno ${stavke.length} stavki — ukupno ${stavkeTotal.toFixed(2)} €`
        toast.success(poruka)
      } else {
        toast.success(`Vraćeno na lager: ${stavke.length} stavki`)
      }

      if (otvorenaOsoba && osobaDetalj && stavke.length === osobaDetalj.stavke.length) {
        setOtvorenaOsoba(null)
      }
    } catch (err) {
      toast.error('Greška pri razduženju!')
    } finally {
      setLoading(false)
    }
  }

  async function razduziRezervaciju(rez: any, placeno: boolean) {
    await razduziStavke([rez], placeno)
  }

  async function sacuvajArtikal(e: React.FormEvent) {
    e.preventDefault()
    if (currentUser?.uloga !== 'admin') {
      toast.error('Samo admin može dodavati artikle.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        naziv,
        osnovna_cena: Number(osnovna),
        cena_serviser: Number(serviser),
        cena_kolega: Number(kolega),
        kolicina: Number(kolicina),
        kategorija: kategorija || null,
        ulazna_cena: ulazna ? Number(ulazna) : 0,
      }
      if (editId) {
        const res = await supabase.from('artikli').update(payload).eq('id', editId)
        if ((res as any).error) {
          toast.error('Greška pri izmeni artikla.')
          setLoading(false)
          return
        }
        toast.success('Artikal uspešno izmenjen.')
      } else {
        const res = await supabase.from('artikli').insert(payload)
        if ((res as any).error) {
          toast.error('Greška pri dodavanju artikla.')
          setLoading(false)
          return
        }
        toast.success('Artikal uspešno dodat.')
      }
      resetForme()
      await ucitajArtikle()
      await ucitajKasu()
      setShowForm(false)
    } catch (err) {
      toast.error('Greška pri čuvanju!')
    } finally {
      setLoading(false)
    }
  }

  function resetForme() {
    setNaziv('')
    setOsnovna('')
    setServiser('')
    setKolega('')
    setKolicina('')
    setKategorija('')
    setUlazna('')
  }

  function otvoriZaDodavanje() {
    setEditId(null)
    resetForme()
    setShowForm(true)
  }

  function izmeniArtikal(art: any) {
    setEditId(art.id)
    setNaziv(art.naziv)
    setOsnovna(art.osnovna_cena?.toString() ?? '')
    setServiser(art.cena_serviser?.toString() ?? '')
    setKolega(art.cena_kolega?.toString() ?? '')
    setKolicina(art.kolicina?.toString() ?? '')
    setKategorija(art.kategorija || '')
    setUlazna(art.ulazna_cena?.toString() || '')
    setShowForm(true)
  }

  async function obrisiArtikal(id: string) {
    if (!confirm('Obrisati artikal?')) return
    setLoading(true)
    try {
      const res = await supabase.from('artikli').delete().eq('id', id)
      if ((res as any).error) {
        toast.error('Greška pri brisanju artikla!')
        setLoading(false)
        return
      }
      await ucitajArtikle()
      toast.success('Artikal obrisan.')
    } catch (err) {
      toast.error('Greška pri brisanju!')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out:', err)
    } finally {
      await router.push('/login')
    }
  }

  async function izvrsiResetKase() {
    if (resetCode !== '1234') {
      toast.error('Pogrešan kod!')
      return
    }
    setLoading(true)
    try {
      const res = await supabase.from('kasa').update({ stanje_zarada: 0 }).eq('id', 1)
      if ((res as any).error) {
        toast.error('Greška pri resetu kase!')
        setLoading(false)
        return
      }
      setStanjeKase(0)
      toast.success('Kasa resetovana na 0 €')
      await ucitajKasu()
    } catch (err) {
      toast.error('Greška pri resetu!')
    } finally {
      setLoading(false)
      setShowResetConfirm(false)
      setResetCode('')
    }
  }

  // ---------- Filtering / UI helpers ----------
  const isAdmin = currentUser?.uloga === 'admin'

  const artikliNaIzmaku = artikli.filter(a => Number(a.kolicina ?? 0) <= 1)

  const zeroCount = artikli.filter(a => Number(a.kolicina ?? 0) === 0).length
  const oneCount = artikli.filter(a => Number(a.kolicina ?? 0) === 1).length
  const twoCount = artikli.filter(a => Number(a.kolicina ?? 0) === 2).length
  const lte1Count = artikli.filter(a => Number(a.kolicina ?? 0) <= 1).length
  const lte2Count = artikli.filter(a => Number(a.kolicina ?? 0) <= 2).length

  const matchesPretraga = (naziv: string, pretragaQuery: string): boolean => {
    if (!pretragaQuery.trim()) return true
    const pretragaReči = pretragaQuery.toLowerCase().trim().split(/\s+/)
    const nazivLower = naziv.toLowerCase()
    return pretragaReči.every(reč => nazivLower.includes(reč))
  }

  function matchesStanje(kolicinaNum: number, stav: 'all' | 'zero' | 'one' | 'two' | 'lte1' | 'lte2' | 'gt2') {
    switch (stav) {
      case 'all': return true
      case 'zero': return kolicinaNum === 0
      case 'one': return kolicinaNum === 1
      case 'two': return kolicinaNum === 2
      case 'lte1': return kolicinaNum <= 1
      case 'lte2': return kolicinaNum <= 2
      case 'gt2': return kolicinaNum > 2
      default: return true
    }
  }

  const filtrirani = artikli.filter((a) => {
    if (!isAdmin && a.kategorija && skrivenoZaOstale.includes(a.kategorija)) return false
    const skriveneUloge: Uloga[] = ['lager', 'kolega', 'serviser']
    if (currentUser && skriveneUloge.includes(currentUser.uloga)) {
      if (Number(a.kolicina ?? 0) === 0) return false
    }
    if (!matchesPretraga(a.naziv, debouncedPretraga) || (filterKategorija && a.kategorija !== filterKategorija)) return false
    return true
  })

  const paginated = filtrirani.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filtrirani.length / perPage)
  const dostupneKategorije = kategorije.filter(k => isAdmin || !skrivenoZaOstale.includes(k))

  const dugovanjaPoOsobi: OsobaDugovanje[] = (() => {
    const map = new Map<string, any[]>()
    for (const rez of rezervacije) {
      const key = rez.kome
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(rez)
    }
    return Array.from(map.entries())
      .map(([kome, stavke]) => {
        const ukupno = stavke.reduce((sum, rez) => sum + izracunajCenuStavke(rez) * rez.kolicina, 0)
        const avans = avansZaOsobu(kome)
        const preostalo = Math.max(0, ukupno - avans)
        const dana = Math.max(...stavke.map(s => danaOd(s.datum_rezervacije)))
        return { kome, stavke, ukupno, avans, preostalo, dana }
      })
      .sort((a, b) => b.dana - a.dana || b.preostalo - a.preostalo)
  })()

  const ukupnoDugovanja = dugovanjaPoOsobi.reduce((sum, o) => sum + o.preostalo, 0)
  const brojOsobaDugovanja = dugovanjaPoOsobi.length
  const osobaDetalj = otvorenaOsoba ? dugovanjaPoOsobi.find(o => o.kome === otvorenaOsoba) : null

  const predloziZaRezervaciju = dugovanjaPoOsobi.map(o => ({
    name: o.kome,
    count: o.stavke.length,
  }))

  const predloziImenaOsoba = (() => {
    const map = new Map<string, string>()
    for (const p of profiles) {
      const key = p.username.toLowerCase()
      if (!map.has(key)) map.set(key, p.username)
    }
    for (const o of dugovanjaPoOsobi) {
      const key = o.kome.toLowerCase()
      if (!map.has(key)) map.set(key, o.kome)
    }
    if (preimenujStaroIme) map.delete(preimenujStaroIme.toLowerCase())
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'sr'))
  })()

  const spajanjeCilj = preimenujNovoIme.trim()
    ? dugovanjaPoOsobi.find(o =>
        o.kome.toLowerCase() === preimenujNovoIme.trim().toLowerCase() &&
        o.kome !== preimenujStaroIme
      )
    : null

  const stavkeZaPreimenovanje = rezervacije.filter(r => r.kome === preimenujStaroIme)

  const dohvatiIkonu = (kategorija: string | null) => {
    if (!kategorija) return CubeIcon
    if (kategorija.toUpperCase().includes('LCD')) return DevicePhoneMobileIcon
    if (kategorija.toUpperCase().includes('BATERIJE')) return Battery100Icon
    return CubeIcon
  }

  if (!currentUser) return <div className="p-10 text-center text-xl text-gray-900 dark:text-gray-100">Učitavanje korisnika...</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* HEADER */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6">
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 shadow-lg">
                  <CubeIcon className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-white">Magacin</h1>
                  <p className="text-white/70 text-sm mt-1">Interni sistem za upravljanje lagerom • v1.0</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-white/80 text-sm">Ulogovan kao</p>
                  <p className="text-xl font-bold text-white">{currentUser.username}</p>
                </div>
                <span className={`px-5 py-2 rounded-full text-white font-bold text-sm shadow-md ${ulogaBoja[currentUser.uloga] || 'bg-gray-600'}`}>
                  {ulogaNaziv[currentUser.uloga]}
                </span>
                <button onClick={logout} className="bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl px-5 py-3 flex items-center gap-2 transition shadow-md">
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  <span className="font-medium">Odjavi se</span>
                </button>
              </div>
            </div>
            <div className="flex sm:hidden items-center justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-white">Magacin</h1>
                <p className="text-white/80 text-xs mt-0.5">{currentUser.username}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${ulogaBoja[currentUser.uloga] || 'bg-gray-600'}`}>
                  {ulogaNaziv[currentUser.uloga]}
                </span>
                <button onClick={logout} className="bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl px-3 py-2 flex items-center gap-2 transition shadow-md text-white text-sm">
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  <span>Odjavi se</span>
                </button>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="px-4 sm:px-8 py-4 sm:py-5 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-4">
                <Link href="/admin/prodaje" className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg">
                  <ChartBarIcon className="w-5 h-5" />
                  Pregled prodaja
                </Link>
                <Link href="/admin/korisnici" className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/50 dark:hover:bg-slate-900/70 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg">
                  <UserIcon className="w-5 h-5" />
                  Korisnici
                </Link>
                <button onClick={() => { setShowKriticniModal(true); setKriticniFilter('lte1') }} className="relative flex items-center gap-2 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/50 dark:hover:bg-orange-900/70 text-orange-700 dark:text-orange-200 px-4 py-2 rounded-lg">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  Kritično stanje
                  {artikliNaIzmaku.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center animate-pulse shadow-lg">
                      {artikliNaIzmaku.length}
                    </span>
                  )}
                </button>
                <button onClick={otvoriDugovanjaModal} className="relative flex items-center gap-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-200 px-4 py-2 rounded-lg">
                  <UserGroupIcon className="w-5 h-5" />
                  Otvorena dugovanja
                  {brojOsobaDugovanja > 0 && (
                    <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center shadow-lg">
                      {brojOsobaDugovanja}
                    </span>
                  )}
                </button>
                <button onClick={() => setShowVrednostPoKategorijama(true)} className="flex items-center gap-2 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/50 dark:hover:bg-teal-900/70 text-teal-700 dark:text-teal-200 px-4 py-2 rounded-lg">
                  <ChartBarIcon className="w-5 h-5" />
                  Vrednost po kategorijama
                </button>
                <button onClick={() => otvoriPrijem()} className="flex items-center gap-2 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/50 dark:hover:bg-cyan-900/70 text-cyan-800 dark:text-cyan-200 px-4 py-2 rounded-lg">
                  <ArchiveBoxArrowDownIcon className="w-5 h-5" />
                  Prijem robe
                </button>
                <button onClick={() => setShowPrijemiHistoria(true)} className="flex items-center gap-2 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 px-3 py-2 rounded-lg text-sm">
                  Istorija prijema
                </button>
                <Link href="/poklopci" className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 px-4 py-2 rounded-lg font-medium">
                  <DevicePhoneMobileIcon className="w-5 h-5" />
                  Zadnji poklopci
                </Link>
                <button onClick={otvoriZaDodavanje} className="ml-auto flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-lg">
                  <PlusIcon className="w-6 h-6" />
                  Dodaj novi artikal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* INFO BAR — sakriveno dok se ne klikne */}
        {isAdmin && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInfoBar(prev => !prev)}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-left"
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-xl p-2.5">
                  <ChartBarIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">Pregled stanja</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {showInfoBar ? 'Klikni da sakriješ' : 'Klikni za vrednost lagera, kasu, dugovanja...'}
                  </p>
                </div>
              </div>
              <ChevronDownIcon className={`w-6 h-6 text-gray-400 shrink-0 transition-transform duration-200 ${showInfoBar ? 'rotate-180' : ''}`} />
            </button>

            {showInfoBar && (
              <div className="p-6 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-2xl px-6 py-4 shadow-md flex-1 min-w-[220px]">
                    <div className="bg-indigo-600 dark:bg-indigo-500 rounded-xl p-3">
                      <CubeIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Vrednost lagera</p>
                      <p className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-400">{novacULageru.toFixed(2)} €</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl px-6 py-4 shadow-md flex-1 min-w-[220px]">
                    <div className="bg-green-600 dark:bg-green-500 rounded-xl p-3">
                      <CurrencyEuroIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Stanje kase</p>
                      <p className="text-3xl font-extrabold text-green-700 dark:text-green-400">{stanjeKase.toFixed(2)} €</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={otvoriDugovanjaModal}
                    className="flex items-center gap-4 bg-gradient-to-r from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-800/30 rounded-2xl px-6 py-4 shadow-md flex-1 min-w-[220px] text-left hover:shadow-lg transition"
                  >
                    <div className="bg-amber-600 dark:bg-amber-500 rounded-xl p-3">
                      <UserGroupIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Na dugovanju</p>
                      <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-400">{ukupnoDugovanja.toFixed(2)} €</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{brojOsobaDugovanja} {brojOsobaDugovanja === 1 ? 'osoba' : 'osobe'} · {rezervacije.length} stavki</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl px-6 py-4 shadow-md flex-1 min-w-[220px]">
                    <div className="bg-purple-600 dark:bg-purple-500 rounded-xl p-3">
                      <ShoppingBagIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Ukupno artikala</p>
                      <p className="text-3xl font-extrabold text-purple-700 dark:text-purple-400">{artikli.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button onClick={() => setShowResetConfirm(true)} className="flex items-center gap-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl transition">
                      <CurrencyEuroIcon className="w-6 h-6" />
                      Resetuj kasu
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search + category */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Pretraži artikle..."
              value={pretraga}
              onChange={(e) => { setPretraga(e.target.value); setPage(1) }}
              className="w-full pl-12 pr-6 py-4 border border-gray-300 dark:border-gray-600 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-500 shadow-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <select
            value={filterKategorija}
            onChange={(e) => { setFilterKategorija(e.target.value); setPage(1) }}
            className="px-6 py-4 border border-gray-300 dark:border-gray-600 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-500 shadow-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">Sve kategorije</option>
            {dostupneKategorije.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Inventory list */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <ShoppingBagIcon className="w-8 h-8" /> Lager ({filtrirani.length} artikala)
            </h2>
          </div>

          {/* Desktop table – ispravljeno */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="p-4 text-left">Artikal</th>
                  {currentUser?.uloga === 'admin' ? (
                    <>
                      <th className="p-4 text-right">Nabavna cena</th>
                      <th className="p-4 text-right">Cena serviser</th>
                      <th className="p-4 text-right">Cena kolega</th>
                    </>
                  ) : (
                    <th className="p-4 text-right">
                      {currentUser?.uloga === 'lager' && 'Nabavna cena'}
                      {currentUser?.uloga === 'serviser' && 'Cena serviser'}
                      {currentUser?.uloga === 'kolega' && 'Cena kolega'}
                    </th>
                  )}
                  <th className="p-4 text-right">Količina</th>
                  {isAdmin && <th className="p-4 text-center">Akcije</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 3} className="p-12 text-center text-gray-500 dark:text-gray-400">
                      Nema artikala za izabrani filter. Pokušaj drugu pretragu ili kategoriju.
                    </td>
                  </tr>
                ) : paginated.map((art) => {
                  const jeKriticno = art.kolicina <= 1
                  const jeUpozorenje = art.kolicina <= 3 && art.kolicina > 1
                  const Ikonica = dohvatiIkonu(art.kategorija)

                  return (
                    <tr key={art.id} className={`border-t transition ${jeKriticno ? 'bg-red-50 dark:bg-red-900/30' : jeUpozorenje ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}>
                      <td className="p-4 flex items-center gap-4">
                        <Ikonica className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-medium text-lg">{art.naziv}</span>
                      </td>

                      {currentUser?.uloga === 'admin' ? (
                        <>
                          <td className="p-4 text-right text-xl font-medium">{(art.osnovna_cena || 0).toFixed(2)} €</td>
                          <td className="p-4 text-right text-xl font-medium text-orange-600 dark:text-orange-400">{(art.cena_serviser || 0).toFixed(2)} €</td>
                          <td className="p-4 text-right text-xl font-medium text-green-600 dark:text-green-400">{(art.cena_kolega || 0).toFixed(2)} €</td>
                        </>
                      ) : (
                        <td className="p-4 text-right text-xl font-medium text-indigo-600 dark:text-indigo-400">
                          {currentUser?.uloga === 'lager' && (art.osnovna_cena || 0).toFixed(2)}
                          {currentUser?.uloga === 'serviser' && (art.cena_serviser || 0).toFixed(2)}
                          {currentUser?.uloga === 'kolega' && (art.cena_kolega || 0).toFixed(2)} €
                        </td>
                      )}

                      <td className={`p-4 text-right font-bold text-xl ${jeKriticno ? 'text-red-600' : jeUpozorenje ? 'text-orange-600' : ''}`}>
                        {art.kolicina}
                        {jeKriticno && <span className="block text-xs font-normal text-red-500">kritično</span>}
                        {jeUpozorenje && <span className="block text-xs font-normal text-orange-500">malo</span>}
                      </td>

                      {isAdmin && (
                        <td className="p-4 text-center space-x-4">
                          <button onClick={() => otvoriProdaju(art)} title="Prodaj" aria-label="Prodaj" className="text-green-600 hover:text-green-800"><ShoppingBagIcon className="w-6 h-6 inline" /></button>
                          <button onClick={() => otvoriPrijem(art)} title="Prijem" aria-label="Prijem robe" className="text-cyan-600 hover:text-cyan-800"><ArchiveBoxArrowDownIcon className="w-6 h-6 inline" /></button>
                          <button onClick={() => otvoriRezervaciju(art)} title="Rezerviši" aria-label="Rezerviši" className="text-orange-600 hover:text-orange-800"><ClockIcon className="w-6 h-6 inline" /></button>
                          <button onClick={() => izmeniArtikal(art)} title="Izmeni" aria-label="Izmeni artikal" className="text-blue-600 hover:text-blue-800"><PencilSquareIcon className="w-6 h-6 inline" /></button>
                          <button onClick={() => obrisiArtikal(art.id)} title="Obriši" aria-label="Obriši artikal" className="text-red-600 hover:text-red-800"><TrashIcon className="w-6 h-6 inline" /></button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="block lg:hidden space-y-5 px-2 pb-4">
            {paginated.length === 0 ? (
              <p className="text-center py-12 text-gray-500 dark:text-gray-400">
                Nema artikala za izabrani filter.
              </p>
            ) : paginated.map((art) => {
              const Ikonica = dohvatiIkonu(art.kategorija)
              const cenaInfo = currentUser?.uloga === 'kolega' ? { cena: art.cena_kolega, label: 'Cena kolega' } :
                              currentUser?.uloga === 'serviser' ? { cena: art.cena_serviser, label: 'Cena serviser' } :
                              currentUser?.uloga === 'lager' ? { cena: art.osnovna_cena, label: 'Nabavna cena' } :
                              { cena: art.osnovna_cena, label: 'Cena' }
              const jeKriticno = art.kolicina <= 1
              const jeUpozorenje = art.kolicina <= 3 && art.kolicina > 1
              return (
                <div key={art.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border-2 transition-all ${jeKriticno ? 'border-red-500 shadow-red-500/20' : jeUpozorenje ? 'border-orange-500 shadow-orange-500/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${jeKriticno ? 'bg-red-100 dark:bg-red-900/50' : jeUpozorenje ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-indigo-100 dark:bg-indigo-900/50'}`}>
                        <Ikonica className={`w-8 h-8 ${jeKriticno ? 'text-red-600' : jeUpozorenje ? 'text-orange-600' : 'text-indigo-600'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">{art.naziv}</h3>
                        {art.kategorija && <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-1">{art.kategorija}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-5 bg-gray-50/70 dark:bg-gray-900/50">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">{cenaInfo.label}</p>
                        <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">{(cenaInfo.cena || 0).toFixed(2)} €</p>
                      </div>
                      <div className="text-center flex flex-col justify-center">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">Količina na lageru</p>
                        <p className={`text-2xl font-bold mt-1 ${jeKriticno ? 'text-red-600' : jeUpozorenje ? 'text-orange-600' : 'text-gray-600 dark:text-gray-400'}`}>
                          {art.kolicina}
                        </p>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="px-5 py-4 bg-gray-100 dark:bg-gray-800/70 border-t border-gray-200 dark:border-gray-700 flex justify-center flex-wrap gap-4 sm:gap-8">
                      <button onClick={() => otvoriProdaju(art)} title="Prodaj" aria-label="Prodaj" className="p-4 min-w-[3.5rem] min-h-[3.5rem] bg-green-100 dark:bg-green-900/50 rounded-xl hover:bg-green-200 dark:hover:bg-green-900/70 transition shadow-md">
                        <ShoppingBagIcon className="w-7 h-7 text-green-600 dark:text-green-400" />
                      </button>
                      <button onClick={() => otvoriPrijem(art)} title="Prijem" aria-label="Prijem robe" className="p-4 min-w-[3.5rem] min-h-[3.5rem] bg-cyan-100 dark:bg-cyan-900/50 rounded-xl hover:bg-cyan-200 dark:hover:bg-cyan-900/70 transition shadow-md">
                        <ArchiveBoxArrowDownIcon className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                      </button>
                      <button onClick={() => otvoriRezervaciju(art)} title="Rezerviši" aria-label="Rezerviši" className="p-4 min-w-[3.5rem] min-h-[3.5rem] bg-orange-100 dark:bg-orange-900/50 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/70 transition shadow-md">
                        <ClockIcon className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                      </button>
                      <button onClick={() => izmeniArtikal(art)} title="Izmeni" aria-label="Izmeni" className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/70 transition shadow-md">
                        <PencilSquareIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button onClick={() => obrisiArtikal(art.id)} title="Obriši" aria-label="Obriši" className="p-4 bg-red-100 dark:bg-red-900/50 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/70 transition shadow-md">
                        <TrashIcon className="w-7 h-7 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-6 border-t bg-gray-50 dark:bg-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition disabled:cursor-not-allowed">
                ← Prethodna
              </button>
              <span className="text-lg font-medium">Strana {page} od {totalPages} ({filtrirani.length} artikala)</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition disabled:cursor-not-allowed">
                Sledeća →
              </button>
            </div>
          )}
        </div>

        {/* SVI MODALI – puni, neizmenjeni */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full my-4 flex flex-col max-h-[95vh]">
              <div className="bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white px-6 py-5 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 rounded-xl p-3">
                      <CubeIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{editId ? 'Izmeni artikal' : 'Novi artikal'}</h2>
                    </div>
                  </div>
                  <button onClick={() => { setShowForm(false); setEditId(null); resetForme() }} className="bg-white/20 hover:bg-white/30 rounded-xl p-2 transition">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <form onSubmit={sacuvajArtikal} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Naziv artikla</label>
                  <input required value={naziv} onChange={e => setNaziv(e.target.value)} className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-purple-400 text-base" placeholder="npr. iPhone 14 LCD Original" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Količina</label>
                    <input type="number" required value={kolicina} onChange={e => setKolicina(e.target.value)} className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Kategorija</label>
                    <select value={kategorija} onChange={e => setKategorija(e.target.value)} className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-400">
                      <option value="">Izaberi...</option>
                      {kategorije.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <CurrencyEuroIcon className="w-5 h-5 text-green-600" />
                    Cene artikla
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-2xl p-4 text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Nabavna</p>
                      <input type="number" step="0.01" required value={osnovna} onChange={e => setOsnovna(e.target.value)} className="mt-1 w-full text-xl font-bold text-indigo-700 dark:text-indigo-400 bg-transparent text-center outline-none" placeholder="0.00" />
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-2xl p-4 text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Serviser</p>
                      <input type="number" step="0.01" required value={serviser} onChange={e => setServiser(e.target.value)} className="mt-1 w-full text-xl font-bold text-orange-700 dark:text-orange-400 bg-transparent text-center outline-none" placeholder="0.00" />
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl p-4 text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Kolega</p>
                      <input type="number" step="0.01" required value={kolega} onChange={e => setKolega(e.target.value)} className="mt-1 w-full text-xl font-bold text-green-700 dark:text-green-400 bg-transparent text-center outline-none" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Ulazna cena (opcionalno)</label>
                    <input type="number" step="0.01" value={ulazna} onChange={e => setUlazna(e.target.value)} className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-yellow-400" placeholder="0.00 €" />
                  </div>
                  {ulazna && osnovna && Number(ulazna) > 0 && Number(osnovna) > 0 && (
                    <div className="flex justify-center">
                      <div className="bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-600 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm">
                        Marža: <span className="font-bold text-yellow-700 dark:text-yellow-400">{(Number(osnovna) - Number(ulazna)).toFixed(2)} €</span> ({((Number(osnovna) / Number(ulazna) - 1) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-3xl">
                  <div className="flex gap-4">
                    <button type="button" onClick={() => { setShowForm(false); setEditId(null); resetForme() }} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl font-medium transition">Otkaži</button>
                    <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-70 text-white rounded-xl font-bold transition shadow-md">
                      {loading ? 'Čuvam...' : editId ? 'Sačuvaj' : 'Dodaj artikal'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {showProdaja && prodajaArtikal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <ShoppingBagIcon className="w-7 h-7 text-green-600" />
                  Prodaja
                </h3>
                <button onClick={() => setShowProdaja(false)} className="text-gray-500 hover:text-gray-700"><XMarkIcon className="w-7 h-7" /></button>
              </div>
              <p className="text-lg font-semibold text-center mb-5 text-gray-900 dark:text-gray-100">{prodajaArtikal.naziv}</p>
              <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg py-3 px-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Ulazna</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{prodajaArtikal.ulazna_cena > 0 ? prodajaArtikal.ulazna_cena.toFixed(2) : '—'} €</p>
                </div>
                <div className="bg-indigo-100 dark:bg-indigo-900/40 rounded-lg py-3 px-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Nabavna</p>
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{(prodajaArtikal.osnovna_cena || 0).toFixed(2)} €</p>
                </div>
                {prodajaArtikal.ulazna_cena > 0 && (
                  <div className="bg-yellow-100 dark:bg-yellow-900/50 rounded-lg py-3 px-2 border border-yellow-500 dark:border-yellow-600">
                    <p className="text-xs text-gray-700 dark:text-gray-300">Marža</p>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{(prodajaArtikal.osnovna_cena - prodajaArtikal.ulazna_cena).toFixed(2)} €</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Količina (lager: {prodajaArtikal.kolicina})</label>
                  <input type="number" min="1" max={prodajaArtikal.kolicina} value={prodajaKolicina} onChange={e => setProdajaKolicina(Number(e.target.value))} className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cena po komadu (€)</label>
                  <input type="number" step="0.01" value={prodajaCena} onChange={e => setProdajaCena(Number(e.target.value))} placeholder={prodajaArtikal.osnovna_cena?.toFixed(2)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-400" />
                </div>
                {prodajaKolicina > 0 && prodajaCena > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Zarada</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{(prodajaCena * prodajaKolicina).toFixed(2)} €</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowProdaja(false)} className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition">Otkaži</button>
                <button onClick={izvrsiProdaju} disabled={loading || prodajaKolicina < 1 || prodajaKolicina > prodajaArtikal.kolicina} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition">
                  {loading ? 'Prodajem...' : 'Prodaj'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRezervacija && rezArtikal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <ClockIcon className="w-8 h-8 text-orange-600" />
                  Rezerviši artikal
                </h3>
                <button onClick={() => setShowRezervacija(false)}><XMarkIcon className="w-8 h-8" /></button>
              </div>
              <p className="text-lg font-medium mb-2">{rezArtikal.naziv}</p>
              <p className="text-gray-600 dark:text-gray-400 mb-1">Na lageru: <strong>{rezArtikal.kolicina}</strong></p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Nabavna cena: <strong>{(rezArtikal.osnovna_cena || 0).toFixed(2)} €</strong>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Količina</label>
                  <input type="number" min="1" max={rezArtikal.kolicina} value={rezKolicina} onChange={e => setRezKolicina(Number(e.target.value))} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Za koga / kome dao</label>
                  <input
                    type="text"
                    list="rez-kome-predlozi"
                    required
                    value={rezKome}
                    onChange={e => setRezKome(e.target.value)}
                    placeholder="Upiši ili izaberi iz liste..."
                    className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                  <datalist id="rez-kome-predlozi">
                    {predloziZaRezervaciju.map(item => (
                      <option key={item.name} value={item.name} />
                    ))}
                  </datalist>
                  {predloziZaRezervaciju.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Iz otvorenih dugovanja — klikni za brzi izbor:</p>
                      <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                        {predloziZaRezervaciju.slice(0, 12).map(item => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setRezKome(item.name)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                              rezKome.toLowerCase() === item.name.toLowerCase()
                                ? 'bg-orange-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-orange-100 dark:hover:bg-orange-900/40'
                            }`}
                          >
                            {item.name}
                            {item.count > 0 && <span className="ml-1 opacity-70">({item.count})</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Napomena (opcionalno)</label>
                  <textarea rows={3} value={rezNapomena} onChange={e => setRezNapomena(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button onClick={() => setShowRezervacija(false)} className="flex-1 py-3 bg-gray-300 hover:bg-gray-400 rounded-lg">Otkaži</button>
                <button
                  onClick={sacuvajRezervaciju}
                  disabled={loading}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-70"
                >
                  {loading ? 'Rezervišem...' : 'Rezerviši'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showKriticniModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold text-red-600 flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-8 h-8" />
                    Kritična stanja ({artikliNaIzmaku.length})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowKriticniModal(false)} className="bg-transparent p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setKriticniFilter('all')} className={`px-3 py-2 rounded-xl text-sm font-medium ${kriticniFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Sve</button>
                    <button onClick={() => setKriticniFilter('zero')} className={`px-3 py-2 rounded-xl text-sm font-medium ${kriticniFilter === 'zero' ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200'}`}>0 ({zeroCount})</button>
                    <button onClick={() => setKriticniFilter('one')} className={`px-3 py-2 rounded-xl text-sm font-medium ${kriticniFilter === 'one' ? 'bg-orange-600 text-white' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200'}`}>1 ({oneCount})</button>
                    <button onClick={() => setKriticniFilter('two')} className={`px-3 py-2 rounded-xl text-sm font-medium ${kriticniFilter === 'two' ? 'bg-yellow-600 text-white' : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200'}`}>2 ({twoCount})</button>
                    <button onClick={() => setKriticniFilter('lte1')} className={`px-3 py-2 rounded-xl text-sm font-medium ${kriticniFilter === 'lte1' ? 'bg-pink-600 text-white' : 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-200'}`}>≤1 ({lte1Count})</button>
                    <button onClick={() => setKriticniFilter('lte2')} className={`px-3 py-2 rounded-xl text-sm font-medium ${kriticniFilter === 'lte2' ? 'bg-teal-600 text-white' : 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-200'}`}>≤2 ({lte2Count})</button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {artikli.filter(a => matchesStanje(Number(a.kolicina ?? 0), kriticniFilter)).length === 0 ? (
                  <p className="text-center py-10 text-gray-600">Nema artikala za izabrani filter.</p>
                ) : (
                  <div className="space-y-4">
                    {artikli
                      .filter(a => matchesStanje(Number(a.kolicina ?? 0), kriticniFilter))
                      .sort((x, y) => Number(x.kolicina ?? 0) - Number(y.kolicina ?? 0))
                      .map(art => {
                        const Ikonica = dohvatiIkonu(art.kategorija)
                        return (
                          <div key={art.id} className="bg-red-50 dark:bg-red-900/30 rounded-lg p-6 flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <Ikonica className="w-12 h-12 text-red-600" />
                              <div>
                                <p className="text-xl font-bold">{art.naziv}</p>
                                <p className="text-2xl font-bold text-red-600">Količina: {art.kolicina}</p>
                                {art.kategorija && <p className="text-sm text-gray-600 mt-1">{art.kategorija}</p>}
                              </div>
                            </div>
                            <div className="flex gap-4">
                              <button onClick={() => { otvoriProdaju(art); setShowKriticniModal(false); }}><ShoppingBagIcon className="w-7 h-7 text-green-600" /></button>
                              <button onClick={() => { otvoriRezervaciju(art); setShowKriticniModal(false); }}><ClockIcon className="w-7 h-7 text-orange-600" /></button>
                              <button onClick={() => { izmeniArtikal(art); setShowKriticniModal(false); }}><PencilSquareIcon className="w-7 h-7 text-blue-600" /></button>
                              <button onClick={() => { obrisiArtikal(art.id); setShowKriticniModal(false); }}><TrashIcon className="w-7 h-7 text-red-600" /></button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showRezervisaniModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-6 z-10">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-purple-600 flex items-center gap-3">
                      <UserGroupIcon className="w-8 h-8" />
                      Otvorena dugovanja
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      {brojOsobaDugovanja} {brojOsobaDugovanja === 1 ? 'osoba' : 'osobe'} · {rezervacije.length} stavki · ukupno <strong className="text-amber-600">{ukupnoDugovanja.toFixed(2)} €</strong>
                    </p>
                  </div>
                  <button onClick={() => setShowRezervisaniModal(false)}>
                    <XMarkIcon className="w-8 h-8" />
                  </button>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => { setDugovanjaTab('osobe'); setOtvorenaOsoba(null); setIzabraneStavke(new Set()) }}
                    className={`px-4 py-2 rounded-lg font-medium ${dugovanjaTab === 'osobe' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                  >
                    Po osobi
                  </button>
                  <button
                    onClick={() => { setDugovanjaTab('sve'); setOtvorenaOsoba(null); setIzabraneStavke(new Set()) }}
                    className={`px-4 py-2 rounded-lg font-medium ${dugovanjaTab === 'sve' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                  >
                    Sve stavke
                  </button>
                </div>
              </div>

              <div className="p-6">
                {rezervacije.length === 0 ? (
                  <p className="text-center py-10 text-gray-600">Nema otvorenih dugovanja.</p>
                ) : dugovanjaTab === 'osobe' && !otvorenaOsoba ? (
                  <div className="space-y-3">
                    {dugovanjaPoOsobi.map(osoba => {
                      return (
                        <div
                          key={osoba.kome}
                          className="w-full bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-xl p-5 flex items-center justify-between transition"
                        >
                          <button
                            type="button"
                            onClick={() => { setOtvorenaOsoba(osoba.kome); setIzabraneStavke(new Set()) }}
                            className="flex items-center gap-4 flex-1 text-left min-w-0"
                          >
                            <div className="bg-purple-600 rounded-full p-3 shrink-0">
                              <UserIcon className="w-6 h-6 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xl font-bold truncate">{osoba.kome}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {osoba.stavke.length} {osoba.stavke.length === 1 ? 'stavka' : 'stavke'} · nabavna cena
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <div className="text-right">
                              <p className="text-2xl font-extrabold text-amber-600">{osoba.preostalo.toFixed(2)} €</p>
                              {osoba.avans > 0 && (
                                <p className="text-xs text-green-600">uplaćeno {osoba.avans.toFixed(2)} / {osoba.ukupno.toFixed(2)} €</p>
                              )}
                              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${badgeStarosti(osoba.dana)}`}>
                                {osoba.dana === 0 ? 'danas' : `${osoba.dana} d`}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => otvoriPreimenujModal(osoba.kome)}
                              title="Izmeni ili spoji ime"
                              className="p-2.5 rounded-lg bg-white/80 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 transition"
                            >
                              <PencilSquareIcon className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setOtvorenaOsoba(osoba.kome); setIzabraneStavke(new Set()) }}
                              className="p-2 text-gray-400 hover:text-purple-600"
                            >
                              <ChevronRightIcon className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : dugovanjaTab === 'osobe' && osobaDetalj ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => { setOtvorenaOsoba(null); setIzabraneStavke(new Set()) }}
                      className="text-purple-600 hover:text-purple-800 font-medium mb-4"
                    >
                      ← Nazad na listu osoba
                    </button>
                    <div className="bg-gradient-to-r from-purple-50 to-amber-50 dark:from-purple-900/30 dark:to-amber-900/20 rounded-xl p-5 mb-5 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="text-2xl font-bold flex items-center gap-2">
                          <UserIcon className="w-7 h-7 text-purple-600" />
                          {osobaDetalj.kome}
                        </h4>
                        <p className={`text-sm font-medium mt-1 ${bojaStarosti(osobaDetalj.dana)}`}>
                          Najstarija stavka: {osobaDetalj.dana === 0 ? 'danas' : `pre ${osobaDetalj.dana} dana`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => otvoriPreimenujModal(osobaDetalj.kome)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg font-medium transition"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                          Izmeni / spoji ime
                        </button>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Preostalo za naplatu</p>
                          <p className="text-3xl font-extrabold text-amber-600">{osobaDetalj.preostalo.toFixed(2)} €</p>
                          {osobaDetalj.avans > 0 && (
                            <p className="text-sm text-green-600 mt-1">
                              Stavke: {osobaDetalj.ukupno.toFixed(2)} € · Uplaćeno: {osobaDetalj.avans.toFixed(2)} €
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => { setDelimicnoIznos(''); setDelimicnoNapomena(''); setShowDelimicnoPlacanje(true) }}
                        disabled={loading || osobaDetalj.preostalo <= 0}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60"
                      >
                        Delimično plaćanje
                      </button>
                      <button
                        onClick={() => razduziStavke(osobaDetalj.stavke, true)}
                        disabled={loading}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-60"
                      >
                        Plati sve ({osobaDetalj.preostalo.toFixed(2)} €)
                      </button>
                      <button
                        onClick={() => razduziStavke(osobaDetalj.stavke.filter(s => izabraneStavke.has(s.id)), true)}
                        disabled={loading || izabraneStavke.size === 0}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-60"
                      >
                        Plati izabrano ({izabraneStavke.size})
                      </button>
                      <button
                        onClick={() => razduziStavke(osobaDetalj.stavke.filter(s => izabraneStavke.has(s.id)), false)}
                        disabled={loading || izabraneStavke.size === 0}
                        className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-60"
                      >
                        Vrati izabrano
                      </button>
                    </div>

                    <div className="space-y-3">
                      {osobaDetalj.stavke.map(rez => {
                        const napomena = prikaziNapomenu(rez.napomena)
                        const cena = izracunajCenuStavke(rez)
                        const ukupnoStavka = cena * rez.kolicina
                        const dana = danaOd(rez.datum_rezervacije)
                        return (
                          <div key={rez.id} className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 flex items-start gap-4">
                            <input
                              type="checkbox"
                              checked={izabraneStavke.has(rez.id)}
                              onChange={() => toggleStavka(rez.id)}
                              className="mt-1.5 w-5 h-5 rounded"
                            />
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-bold">{rez.artikli?.naziv || 'Nepoznat artikal'}</p>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeStarosti(dana)}`}>
                                  {dana === 0 ? 'danas' : `${dana} d`}
                                </span>
                              </div>
                              <p className="text-gray-600 dark:text-gray-300 mt-1">
                                {rez.kolicina} × {cena.toFixed(2)} € (nabavna) = <strong>{ukupnoStavka.toFixed(2)} €</strong>
                              </p>
                              {napomena && <p className="text-sm text-gray-500 mt-1">{napomena}</p>}
                              <p className="text-xs text-gray-400 mt-1">{new Date(rez.datum_rezervacije).toLocaleString('sr-RS')}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button type="button" onClick={() => otvoriIzmenuStavke(rez)} disabled={loading} className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-1">
                                <PencilSquareIcon className="w-4 h-4" /> Izmeni
                              </button>
                              <button onClick={() => razduziRezervaciju(rez, true)} disabled={loading} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-60">Plaćeno</button>
                              <button onClick={() => razduziRezervaciju(rez, false)} disabled={loading} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm disabled:opacity-60">Vrati</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rezervacije.map(rez => {
                      const napomena = prikaziNapomenu(rez.napomena)
                      const cena = izracunajCenuStavke(rez)
                      const dana = danaOd(rez.datum_rezervacije)
                      return (
                        <div key={rez.id} className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-5 flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <p className="text-lg font-bold">{rez.artikli?.naziv || 'Nepoznat artikal'}</p>
                            <p className="mt-1">Za: <strong>{rez.kome}</strong> · {rez.kolicina} kom · <strong>{(cena * rez.kolicina).toFixed(2)} €</strong> (nabavna)</p>
                            {napomena && <p className="text-sm text-gray-500 mt-1">{napomena}</p>}
                            <p className={`text-sm mt-1 ${bojaStarosti(dana)}`}>{new Date(rez.datum_rezervacije).toLocaleString('sr-RS')} · {dana === 0 ? 'danas' : `${dana} dana`}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => razduziRezervaciju(rez, true)} disabled={loading} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-60">Plaćeno</button>
                            <button onClick={() => razduziRezervaciju(rez, false)} disabled={loading} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm disabled:opacity-60">Vrati</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showPrijem && (
          <div className="fixed inset-0 bg-black/60 modal-overlay flex items-end sm:items-center justify-center z-[60]">
            <form onSubmit={sacuvajPrijem} className="modal-panel modal-panel-sheet bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-cyan-700 flex items-center gap-2">
                  <ArchiveBoxArrowDownIcon className="w-7 h-7" /> Prijem robe
                </h3>
                <button type="button" onClick={() => setShowPrijem(false)}><XMarkIcon className="w-7 h-7" /></button>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Artikal</label>
                <select required value={prijemArtikal?.id || ''} onChange={e => {
                  const art = artikli.find(a => a.id === e.target.value)
                  setPrijemArtikal(art || null)
                  if (art) setPrijemCena(String(ulaznaArtikla(art) || ''))
                }} className="w-full mt-1 px-4 py-3 border rounded-lg dark:bg-gray-700 text-base">
                  <option value="">— Izaberi artikal —</option>
                  {artikli.map(a => <option key={a.id} value={a.id}>{a.naziv} ({a.kolicina} kom)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Količina</label>
                  <input required type="number" min="1" value={prijemKolicina} onChange={e => setPrijemKolicina(e.target.value)}
                    className="w-full mt-1 px-4 py-3 border rounded-lg dark:bg-gray-700 text-base" placeholder="+10" />
                </div>
                <div>
                  <label className="text-sm font-medium">Ulazna cena ovog prijema €/kom</label>
                  <input required type="number" step="0.01" min="0" value={prijemCena} onChange={e => setPrijemCena(e.target.value)}
                    className="w-full mt-1 px-4 py-3 border rounded-lg dark:bg-gray-700 text-base" placeholder="npr. 8.00" />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={prijemAzurirajCenu} onChange={e => setPrijemAzurirajCenu(e.target.checked)} className="w-4 h-4 mt-1" />
                <span>
                  Preračunaj <strong>prosečnu ulaznu</strong> cenu
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Samo ulazna — prodajna/nabavna (osnovna) ostaje nepromenjena
                  </span>
                </span>
              </label>
              {prijemAzurirajCenu && prijemArtikal && Number(prijemKolicina) > 0 && prijemCena !== '' && (() => {
                const stK = Number(prijemArtikal.kolicina ?? 0)
                const stC = ulaznaArtikla(prijemArtikal)
                const dK = Math.floor(Number(prijemKolicina))
                const dC = Number(prijemCena)
                const pros = prosecanNabavna(stK, stC, dK, dC)
                const uk = stK + dK
                return (
                  <div className="text-sm bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg px-3 py-2 space-y-1">
                    <p>
                      Pregled: <strong>{stK} × {stC.toFixed(2)} €</strong> + <strong>{dK} × {dC.toFixed(2)} €</strong>
                      {' → '}
                      <strong>{uk} kom × {pros.toFixed(2)} €</strong> prosečno
                    </p>
                    <p className="text-xs text-gray-500">
                      Vrednost lagera posle prijema: {(uk * pros).toFixed(2)} €
                    </p>
                  </div>
                )
              })()}
              <input type="text" placeholder="Dobavljač" value={prijemDobavljac} onChange={e => setPrijemDobavljac(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 text-base" />
              <input type="date" value={prijemDatum} onChange={e => setPrijemDatum(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 text-base" />
              <textarea rows={2} placeholder="Napomena" value={prijemNapomena} onChange={e => setPrijemNapomena(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700 text-base" />
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold text-lg disabled:opacity-60">
                {loading ? 'Evidentiram...' : 'Evidentiraj prijem'}
              </button>
            </form>
          </div>
        )}

        {showPrijemiHistoria && (
          <div className="fixed inset-0 bg-black/60 modal-overlay flex items-end sm:items-center justify-center z-[60]">
            <div className="modal-panel modal-panel-sheet bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-5 border-b flex justify-between items-center shrink-0">
                <h3 className="text-xl font-bold text-cyan-700">Istorija prijema</h3>
                <button onClick={() => setShowPrijemiHistoria(false)}><XMarkIcon className="w-7 h-7" /></button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 space-y-2">
                {prijemi.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">Nema evidentiranih prijema.</p>
                ) : prijemi.map(p => (
                  <div key={p.id} className="border rounded-lg p-3 flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.artikli?.naziv || 'Artikal'}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(p.datum).toLocaleDateString('sr-RS')}
                        {p.dobavljac ? ` · ${p.dobavljac}` : ''}
                        {p.uneto_od ? ` · ${p.uneto_od}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-cyan-700">+{p.kolicina} kom</p>
                      <p className="text-sm">{Number(p.cena_po_komadu).toFixed(2)} €/kom</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showDelimicnoPlacanje && osobaDetalj && (
          <div className="fixed inset-0 bg-black/60 modal-overlay flex items-end sm:items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-blue-600">Delimično plaćanje</h3>
                <button onClick={() => setShowDelimicnoPlacanje(false)}><XMarkIcon className="w-7 h-7" /></button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>{osobaDetalj.kome}</strong> · preostalo: <strong>{osobaDetalj.preostalo.toFixed(2)} €</strong>
              </p>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={osobaDetalj.preostalo}
                placeholder="Iznos uplate €"
                value={delimicnoIznos}
                onChange={e => setDelimicnoIznos(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700"
                autoFocus
              />
              <textarea
                rows={2}
                placeholder="Napomena (opciono)"
                value={delimicnoNapomena}
                onChange={e => setDelimicnoNapomena(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowDelimicnoPlacanje(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-600 rounded-lg">Otkaži</button>
                <button onClick={evidentirajDelimicnoPlacanje} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
                  {loading ? 'Čuvam...' : 'Evidentiraj uplatu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showIzmenaStavke && izmenaStavkaRez && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-blue-600">Izmeni stavku</h3>
                <button onClick={() => setShowIzmenaStavke(false)}><XMarkIcon className="w-7 h-7" /></button>
              </div>
              <p className="font-medium">{izmenaStavkaRez.artikli?.naziv || 'Artikal'}</p>
              <p className="text-sm text-gray-500">Za: {izmenaStavkaRez.kome}</p>
              <div>
                <label className="text-sm text-gray-600">Količina (kom)</label>
                <input
                  type="number"
                  min="1"
                  value={izmenaKolicina}
                  onChange={e => setIzmenaKolicina(Number(e.target.value))}
                  className="w-full mt-1 px-4 py-3 border rounded-lg dark:bg-gray-700"
                />
                <p className="text-xs text-gray-400 mt-1">Povećanje skida sa lagera, smanjenje vraća na stanje.</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Cena po komadu (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={izmenaCena}
                  onChange={e => setIzmenaCena(Number(e.target.value))}
                  className="w-full mt-1 px-4 py-3 border rounded-lg dark:bg-gray-700"
                />
              </div>
              <p className="text-sm bg-slate-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                Ukupno stavka: <strong>{(Number(izmenaKolicina) * Number(izmenaCena)).toFixed(2)} €</strong>
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowIzmenaStavke(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-600 rounded-lg">Otkaži</button>
                <button onClick={sacuvajIzmenuStavke} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
                  {loading ? 'Čuvam...' : 'Sačuvaj'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPreimenujModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-blue-600">
                  <PencilSquareIcon className="w-8 h-8" />
                  Izmeni / spoji ime
                </h3>
                <button onClick={() => setShowPreimenujModal(false)}><XMarkIcon className="w-8 h-8" /></button>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Trenutno ime: <strong className="text-gray-900 dark:text-white">{preimenujStaroIme}</strong>
                <span className="text-sm text-gray-500 ml-2">({stavkeZaPreimenovanje.length} stavki)</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Novo ime</label>
                  <input
                    type="text"
                    list="osobe-predlozi"
                    value={preimenujNovoIme}
                    onChange={e => setPreimenujNovoIme(e.target.value)}
                    placeholder="npr. Mario"
                    className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700"
                  />
                  <datalist id="osobe-predlozi">
                    {predloziImenaOsoba.map(ime => (
                      <option key={ime} value={ime} />
                    ))}
                  </datalist>
                </div>

                {predloziImenaOsoba.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Brzi izbor (spoji sa postojećom osobom)</p>
                    <div className="flex flex-wrap gap-2">
                      {predloziImenaOsoba.slice(0, 12).map(ime => (
                        <button
                          key={ime}
                          type="button"
                          onClick={() => setPreimenujNovoIme(ime)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                            preimenujNovoIme.toLowerCase() === ime.toLowerCase()
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                          }`}
                        >
                          {ime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {spajanjeCilj && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
                    <strong>Spajanje:</strong> „{preimenujStaroIme}“ ({stavkeZaPreimenovanje.length} stavki) biće spojeno sa „{spajanjeCilj.kome}“ ({spajanjeCilj.stavke.length} stavki) → ukupno {stavkeZaPreimenovanje.length + spajanjeCilj.stavke.length} stavki.
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-8">
                <button onClick={() => setShowPreimenujModal(false)} className="flex-1 py-3 bg-gray-300 hover:bg-gray-400 rounded-lg">Otkaži</button>
                <button
                  onClick={sacuvajPreimenovanje}
                  disabled={loading || !preimenujNovoIme.trim() || preimenujStaroIme.toLowerCase() === preimenujNovoIme.trim().toLowerCase()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-60"
                >
                  {loading ? 'Čuvam...' : spajanjeCilj ? 'Spoji osobe' : 'Sačuvaj ime'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showVrednostPoKategorijama && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-6 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-teal-600 flex items-center gap-3">
                  <ChartBarIcon className="w-8 h-8" />
                  Vrednost lagera po kategorijama
                </h3>
                <button onClick={() => setShowVrednostPoKategorijama(false)}><XMarkIcon className="w-8 h-8" /></button>
              </div>
              <div className="p-6">
                {kategorije.map(kat => {
                  const artikliKat = artikli.filter(a => a.kategorija === kat)
                  const vrednost = artikliKat.reduce((sum, a) => sum + ulaznaArtikla(a) * (a.kolicina || 0), 0)
                  if (vrednost === 0) return null
                  return (
                    <div key={kat} className="flex justify-between items-center py-3 border-b">
                      <span className="font-medium text-lg">{kat}</span>
                      <span className="text-xl font-bold text-teal-600">{vrednost.toFixed(2)} €</span>
                    </div>
                  )
                })}
                <div className="flex justify-between items-center py-4 text-xl font-bold border-t-4 border-teal-600 mt-4">
                  <span>UKUPNO</span>
                  <span>{novacULageru.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
              <h3 className="text-2xl font-bold text-red-600 mb-6 text-center">Reset kase na 0 €?</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">Unesi administratorski kod za potvrdu.</p>
              <input type="password" placeholder="Unesi kod" value={resetCode} onChange={e => setResetCode(e.target.value)} className="w-full px-5 py-4 border border-gray-300 dark:border-gray-600 rounded-xl text-lg mb-6 focus:ring-4 focus:ring-red-400" autoFocus />
              <div className="flex gap-4">
                <button onClick={() => { setShowResetConfirm(false); setResetCode('') }} className="flex-1 py-4 bg-gray-300 hover:bg-gray-400 rounded-xl font-bold transition">Otkaži</button>
                <button onClick={izvrsiResetKase} disabled={loading} className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white rounded-xl font-bold transition">
                  {loading ? 'Resetujem...' : 'Resetuj kasu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}