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
  DevicePhoneMobileIcon,
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  ClockIcon,
  UserIcon,
  UserGroupIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'

type Artikal = {
  id: string
  naziv: string
  model: string | null
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
  poklopci_artikli?: { naziv: string; nabavna_cena: number; prodajna_cena: number }
}

type OsobaDugovanje = {
  kome: string
  stavke: Rezervacija[]
  ukupno: number
  dana: number
}

function danaOd(datum: string): number {
  return Math.floor((Date.now() - new Date(datum).getTime()) / (1000 * 60 * 60 * 24))
}

function badgeStarosti(dana: number): string {
  if (dana >= 7) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (dana >= 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
}

export default function PoklopciDashboard() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [artikli, setArtikli] = useState<Artikal[]>([])
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [stanjeKase, setStanjeKase] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pretraga, setPretraga] = useState('')

  const [showInfoBar, setShowInfoBar] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [naziv, setNaziv] = useState('')
  const [model, setModel] = useState('')
  const [kolicina, setKolicina] = useState('')
  const [nabavna, setNabavna] = useState('')
  const [prodajna, setProdajna] = useState('')

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
  const [dugovanjaTab, setDugovanjaTab] = useState<'osobe' | 'sve'>('osobe')
  const [otvorenaOsoba, setOtvorenaOsoba] = useState<string | null>(null)
  const [izabraneStavke, setIzabraneStavke] = useState<Set<string>>(new Set())

  const [showPreimenuj, setShowPreimenuj] = useState(false)
  const [preimenujStaro, setPreimenujStaro] = useState('')
  const [preimenujNovo, setPreimenujNovo] = useState('')

  const [showResetKase, setShowResetKase] = useState(false)
  const [resetCode, setResetCode] = useState('')

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
    await Promise.all([ucitajArtikle(), ucitajRezervacije(), ucitajKasu()])
  }

  async function ucitajArtikle() {
    const { data, error } = await supabase
      .from('poklopci_artikli')
      .select('*')
      .order('naziv', { ascending: true })
    if (error) {
      toast.error('Greška pri učitavanju poklopaca.')
      return
    }
    setArtikli((data || []).map(a => ({
      ...a,
      kolicina: Number(a.kolicina ?? 0),
      nabavna_cena: Number(a.nabavna_cena ?? 0),
      prodajna_cena: Number(a.prodajna_cena ?? 0),
    })))
  }

  async function ucitajRezervacije() {
    const { data, error } = await supabase
      .from('poklopci_rezervacije')
      .select('*, poklopci_artikli(naziv, nabavna_cena, prodajna_cena)')
      .eq('razduzeno', false)
      .order('datum_rezervacije', { ascending: false })
    if (error) {
      toast.error('Greška pri učitavanju rezervacija.')
      setRezervacije([])
      return
    }
    setRezervacije(data || [])
  }

  async function ucitajKasu() {
    const { data, error } = await supabase.from('poklopci_kasa').select('stanje_zarada').eq('id', 1).single()
    if (!error) setStanjeKase(Number(data?.stanje_zarada ?? 0))
  }

  useEffect(() => { init() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showPreimenuj) { setShowPreimenuj(false); return }
      if (showResetKase) { setShowResetKase(false); setResetCode(''); return }
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
  }, [showPreimenuj, showResetKase, showDugovanja, otvorenaOsoba, showForm, showProdaja, showRezervacija])

  function cenaStavke(rez: Rezervacija): number {
    const a = rez.poklopci_artikli || artikli.find(x => x.id === rez.artikal_id)
    return Number(a?.nabavna_cena ?? 0)
  }

  const vrednostLagera = artikli.reduce((s, a) => s + a.nabavna_cena * a.kolicina, 0)

  const dugovanjaPoOsobi: OsobaDugovanje[] = (() => {
    const map = new Map<string, Rezervacija[]>()
    for (const r of rezervacije) {
      if (!map.has(r.kome)) map.set(r.kome, [])
      map.get(r.kome)!.push(r)
    }
    return Array.from(map.entries())
      .map(([kome, stavke]) => ({
        kome,
        stavke,
        ukupno: stavke.reduce((s, r) => s + cenaStavke(r) * r.kolicina, 0),
        dana: Math.max(...stavke.map(x => danaOd(x.datum_rezervacije))),
      }))
      .sort((a, b) => b.dana - a.dana || b.ukupno - a.ukupno)
  })()

  const ukupnoDugovanja = dugovanjaPoOsobi.reduce((s, o) => s + o.ukupno, 0)
  const osobaDetalj = otvorenaOsoba ? dugovanjaPoOsobi.find(o => o.kome === otvorenaOsoba) : null
  const predloziZaRez = dugovanjaPoOsobi.map(o => ({ name: o.kome, count: o.stavke.length }))

  const filtrirani = artikli.filter(a => {
    const q = pretraga.toLowerCase().trim()
    if (!q) return true
    return a.naziv.toLowerCase().includes(q) || (a.model || '').toLowerCase().includes(q)
  })

  function resetForme() {
    setNaziv(''); setModel(''); setKolicina(''); setNabavna(''); setProdajna('')
  }

  function otvoriDodavanje() {
    setEditId(null); resetForme(); setShowForm(true)
  }

  function izmeniArtikal(a: Artikal) {
    setEditId(a.id)
    setNaziv(a.naziv)
    setModel(a.model || '')
    setKolicina(String(a.kolicina))
    setNabavna(String(a.nabavna_cena))
    setProdajna(String(a.prodajna_cena))
    setShowForm(true)
  }

  async function sacuvajArtikal(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      naziv: naziv.trim(),
      model: model.trim() || null,
      kolicina: Number(kolicina),
      nabavna_cena: Number(nabavna),
      prodajna_cena: Number(prodajna),
    }
    const res = editId
      ? await supabase.from('poklopci_artikli').update(payload).eq('id', editId)
      : await supabase.from('poklopci_artikli').insert(payload)
    setLoading(false)
    if (res.error) { toast.error('Greška pri čuvanju.'); return }
    toast.success(editId ? 'Izmenjeno.' : 'Dodato.')
    setShowForm(false); resetForme()
    await ucitajArtikle()
  }

  async function obrisiArtikal(id: string) {
    if (!confirm('Obrisati poklopac?')) return
    const { error } = await supabase.from('poklopci_artikli').delete().eq('id', id)
    if (error) toast.error('Greška pri brisanju.')
    else { toast.success('Obrisano.'); await ucitajArtikle() }
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
    toast.success(`Prodato ${prodajaKolicina} × ${prodajaArtikal.naziv}`)
    setShowProdaja(false)
    setStanjeKase(prev => prev + zarada)
    await Promise.all([ucitajArtikle(), ucitajKasu()])
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
    for (const rez of stavke) {
      const art = rez.poklopci_artikli || artikli.find(x => x.id === rez.artikal_id)
      const cena = Number(art?.nabavna_cena ?? 0)
      const zarada = cena * rez.kolicina
      if (placeno) {
        const [k, p] = await Promise.all([
          supabase.from('poklopci_kasa').update({ stanje_zarada: kasa + zarada }).eq('id', 1),
          supabase.from('poklopci_prodaje').insert({
            artikal_id: rez.artikal_id,
            kolicina_prodato: rez.kolicina,
            cena_po_komadu: cena,
            ukupna_zarada: zarada,
            prodavac_username: username,
          }),
        ])
        if (k.error || p.error) { setLoading(false); toast.error('Greška.'); return }
        kasa += zarada
      } else {
        const a = artikli.find(x => x.id === rez.artikal_id)
        if (a) await supabase.from('poklopci_artikli').update({ kolicina: a.kolicina + rez.kolicina }).eq('id', rez.artikal_id)
      }
      await supabase.from('poklopci_rezervacije').update({ razduzeno: true }).eq('id', rez.id)
    }
    setStanjeKase(kasa)
    setLoading(false)
    setIzabraneStavke(new Set())
    if (otvorenaOsoba && osobaDetalj && stavke.length === osobaDetalj.stavke.length) setOtvorenaOsoba(null)
    toast.success(placeno ? 'Plaćeno i razduženo.' : 'Vraćeno na stanje.')
    await Promise.all([ucitajArtikle(), ucitajRezervacije(), ucitajKasu()])
  }

  async function sacuvajPreimenovanje() {
    const staro = preimenujStaro.trim()
    const novo = preimenujNovo.trim()
    if (!staro || !novo || staro.toLowerCase() === novo.toLowerCase()) return
    const ids = rezervacije.filter(r => r.kome === staro).map(r => r.id)
    const cilj = dugovanjaPoOsobi.find(o => o.kome.toLowerCase() === novo.toLowerCase() && o.kome !== staro)
    if (!confirm(cilj ? `Spojiti "${staro}" sa "${cilj.kome}"?` : `Preimenovati u "${novo}"?`)) return
    const { error } = await supabase.from('poklopci_rezervacije').update({ kome: cilj ? cilj.kome : novo }).in('id', ids)
    if (error) { toast.error('Greška.'); return }
    setShowPreimenuj(false)
    if (otvorenaOsoba === staro) setOtvorenaOsoba(cilj ? cilj.kome : novo)
    await ucitajRezervacije()
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
        {/* Header */}
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
            <button onClick={() => { setDugovanjaTab('osobe'); setOtvorenaOsoba(null); setShowDugovanja(true) }}
              className="relative flex items-center gap-2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg font-medium">
              <UserGroupIcon className="w-5 h-5" />
              Otvorena dugovanja
              {dugovanjaPoOsobi.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">{dugovanjaPoOsobi.length}</span>
              )}
            </button>
            <button onClick={otvoriDodavanje} className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold">
              <PlusIcon className="w-5 h-5" /> Dodaj poklopac
            </button>
          </div>
        </div>

        {/* Info bar */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-slate-200 dark:border-gray-700 overflow-hidden">
          <button type="button" onClick={() => setShowInfoBar(v => !v)} className="w-full px-5 py-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-gray-700/50">
            <span className="font-medium text-slate-700 dark:text-slate-200">Pregled stanja poklopci</span>
            <ChevronDownIcon className={`w-5 h-5 transition ${showInfoBar ? 'rotate-180' : ''}`} />
          </button>
          {showInfoBar && (
            <div className="p-5 border-t grid sm:grid-cols-3 gap-4">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-xs uppercase text-slate-500">Vrednost lagera</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{vrednostLagera.toFixed(2)} €</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4">
                <p className="text-xs uppercase text-emerald-600">Kasa poklopci</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stanjeKase.toFixed(2)} €</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4">
                <p className="text-xs uppercase text-amber-600">Na dugovanju</p>
                <p className="text-2xl font-bold text-amber-700">{ukupnoDugovanja.toFixed(2)} €</p>
                <p className="text-xs text-slate-500">{dugovanjaPoOsobi.length} osoba</p>
              </div>
              <button onClick={() => setShowResetKase(true)} className="sm:col-span-3 text-left text-red-600 text-sm hover:underline">
                Resetuj kasu poklopci
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={pretraga} onChange={e => setPretraga(e.target.value)} placeholder="Pretraži poklopce..."
            className="w-full pl-10 pr-4 py-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600" />
        </div>

        {/* Lista */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-slate-200 dark:border-gray-700 overflow-hidden">
          {filtrirani.length === 0 ? (
            <p className="p-10 text-center text-gray-500">Nema poklopaca. Dodaj prvi artikal.</p>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {filtrirani.map(a => (
                <div key={a.id} className={`p-4 flex flex-wrap items-center justify-between gap-3 ${a.kolicina <= 1 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <DevicePhoneMobileIcon className="w-8 h-8 text-slate-500 shrink-0" />
                    <div>
                      <p className="font-bold text-lg">{a.naziv}</p>
                      {a.model && <p className="text-sm text-slate-500">{a.model}</p>}
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Nabavna: {a.nabavna_cena.toFixed(2)} € · Prodajna: {a.prodajna_cena.toFixed(2)} €
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xl font-bold ${a.kolicina <= 1 ? 'text-red-600' : ''}`}>{a.kolicina} kom</span>
                    <div className="flex gap-2">
                      <button onClick={() => otvoriProdaju(a)} title="Prodaj" className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><ShoppingBagIcon className="w-5 h-5" /></button>
                      <button onClick={() => otvoriRezervaciju(a)} title="Rezerviši" className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"><ClockIcon className="w-5 h-5" /></button>
                      <button onClick={() => izmeniArtikal(a)} title="Izmeni" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><PencilSquareIcon className="w-5 h-5" /></button>
                      <button onClick={() => obrisiArtikal(a.id)} title="Obriši" className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form artikal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={sacuvajArtikal} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{editId ? 'Izmeni' : 'Novi'} poklopac</h3>
              <button type="button" onClick={() => setShowForm(false)}><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <input required placeholder="Naziv (npr. iPhone 17 Pro - Crni)" value={naziv} onChange={e => setNaziv(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <input placeholder="Model (npr. iPhone 17 Pro)" value={model} onChange={e => setModel(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <input required type="number" min="0" placeholder="Količina" value={kolicina} onChange={e => setKolicina(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <input required type="number" step="0.01" placeholder="Nabavna cena €" value={nabavna} onChange={e => setNabavna(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <input required type="number" step="0.01" placeholder="Prodajna cena €" value={prodajna} onChange={e => setProdajna(e.target.value)} className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700" />
            <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-60">{loading ? 'Čuvam...' : 'Sačuvaj'}</button>
          </form>
        </div>
      )}

      {/* Prodaja */}
      {showProdaja && prodajaArtikal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold">Prodaja — {prodajaArtikal.naziv}</h3>
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

      {/* Rezervacija */}
      {showRezervacija && rezArtikal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold">Rezerviši — {rezArtikal.naziv}</h3>
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

      {/* Dugovanja modal — skraćena verzija glavnog */}
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
                        <span className="font-bold text-amber-700 mr-3">{o.ukupno.toFixed(2)} €</span>
                        <button onClick={() => { setPreimenujStaro(o.kome); setPreimenujNovo(o.kome); setShowPreimenuj(true) }} className="p-2 text-blue-600"><PencilSquareIcon className="w-5 h-5" /></button>
                        <button onClick={() => { setOtvorenaOsoba(o.kome); setIzabraneStavke(new Set()) }}><ChevronRightIcon className="w-5 h-5" /></button>
                      </div>
                    ))}
                </div>
              ) : osobaDetalj && (
                <div>
                  <button onClick={() => setOtvorenaOsoba(null)} className="text-sm text-amber-700 mb-3">← Nazad</button>
                  <h4 className="text-lg font-bold mb-3">{osobaDetalj.kome} — {osobaDetalj.ukupno.toFixed(2)} €</h4>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <button onClick={() => razduziStavke(osobaDetalj.stavke, true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Plati sve</button>
                    <button onClick={() => razduziStavke(osobaDetalj.stavke.filter(s => izabraneStavke.has(s.id)), true)} disabled={izabraneStavke.size === 0} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm disabled:opacity-50">Plati izabrano</button>
                  </div>
                  {osobaDetalj.stavke.map(rez => (
                    <div key={rez.id} className="border rounded-lg p-3 mb-2 flex gap-3 items-start">
                      <input type="checkbox" checked={izabraneStavke.has(rez.id)} onChange={() => setIzabraneStavke(prev => { const n = new Set(prev); n.has(rez.id) ? n.delete(rez.id) : n.add(rez.id); return n })} />
                      <div className="flex-1">
                        <p className="font-medium">{rez.poklopci_artikli?.naziv}</p>
                        <p className="text-sm">{rez.kolicina} × {cenaStavke(rez).toFixed(2)} €</p>
                      </div>
                      <button onClick={() => razduziStavke([rez], true)} className="text-sm px-3 py-1 bg-green-600 text-white rounded">Plaćeno</button>
                      <button onClick={() => razduziStavke([rez], false)} className="text-sm px-3 py-1 bg-orange-600 text-white rounded">Vrati</button>
                    </div>
                  ))}
                </div>
              )}
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
