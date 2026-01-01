'use client'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
} from '@heroicons/react/24/outline'

type Uloga = 'admin' | 'kolega' | 'serviser' | 'lager'

export default function InventoryDashboard() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<{ username: string; uloga: Uloga } | null>(null)
  const [artikli, setArtikli] = useState<any[]>([])
  const [rezervacije, setRezervacije] = useState<any[]>([])
  const [pretraga, setPretraga] = useState('')
  const [filterKategorija, setFilterKategorija] = useState('')
  const [stanjeKase, setStanjeKase] = useState(0)
  const [novacULageru, setNovacULageru] = useState(0)
  const [loading, setLoading] = useState(false)

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

  // Reset kase
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetCode, setResetCode] = useState('')

  // Modali
  const [showKriticniModal, setShowKriticniModal] = useState(false)
  const [showRezervisaniModal, setShowRezervisaniModal] = useState(false)
  const [showVrednostPoKategorijama, setShowVrednostPoKategorijama] = useState(false)

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

  const skrivenoZaOstale = ['BATERIJE IPHONE', 'IPHONE BATERIJE – VERIFY']

  const ulogaBoja: Record<Uloga, string> = {
    admin: 'bg-indigo-600',
    kolega: 'bg-green-600',
    serviser: 'bg-orange-600',
    lager: 'bg-gray-600',
  }

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      await router.push('/login')
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('username, uloga')
      .eq('id', user.id)
      .single()
    if (error || !data) {
      await supabase.auth.signOut()
      await router.push('/login')
      return
    }
    setCurrentUser(data as { username: string; uloga: Uloga })
  }

  async function ucitajArtikle() {
    const { data } = await supabase.from('artikli').select('*').order('naziv', { ascending: true })
    setArtikli(data || [])
    const lager = (data || []).reduce((sum: number, a: any) => sum + a.osnovna_cena * a.kolicina, 0)
    setNovacULageru(lager)
  }

  async function ucitajKasu() {
    const { data } = await supabase.from('kasa').select('stanje_zarada').eq('id', 1).single()
    setStanjeKase(data?.stanje_zarada || 0)
  }

  async function ucitajRezervacije() {
    const { data } = await supabase
      .from('rezervacije')
      .select('*, artikli(naziv, osnovna_cena)')
      .eq('razduzeno', false)
      .order('datum_rezervacije', { ascending: false })
    setRezervacije(data || [])
  }

  useEffect(() => {
    if (!currentUser || currentUser.uloga !== 'admin') return
    const channel = supabase
      .channel('rezervacije-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rezervacije' },
        () => ucitajRezervacije()
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentUser])

  useEffect(() => {
    getCurrentUser()
    ucitajArtikle()
  }, [])

  useEffect(() => {
    if (currentUser?.uloga === 'admin') {
      ucitajKasu()
      ucitajRezervacije()
    }
  }, [currentUser])

  function otvoriProdaju(artikal: any) {
    setProdajaArtikal(artikal)
    setProdajaKolicina(1)
    setProdajaCena(artikal.osnovna_cena)
    setShowProdaja(true)
  }

  async function izvrsiProdaju() {
    setLoading(true)
    try {
      if (!prodajaArtikal || prodajaKolicina <= 0 || prodajaKolicina > prodajaArtikal.kolicina || prodajaCena <= 0) {
        alert('Nevalidna količina ili cena!')
        setLoading(false)
        return
      }
      const zarada = prodajaCena * prodajaKolicina
      await Promise.all([
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
      setArtikli((prev) =>
        prev.map((a) => (a.id === prodajaArtikal.id ? { ...a, kolicina: a.kolicina - prodajaKolicina } : a))
      )
      setStanjeKase((prev) => prev + zarada)
      ucitajArtikle()
      ucitajKasu()
      alert(`Prodato ${prodajaKolicina} × ${prodajaArtikal.naziv}\nZarada: ${zarada.toFixed(2)} €`)
    } catch (err) {
      console.error('Greška pri prodaji:', err)
      alert('Greška pri prodaji!')
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

  async function sacuvajRezervaciju() {
    setLoading(true)
    try {
      if (!rezArtikal || rezKolicina <= 0 || rezKolicina > rezArtikal.kolicina || !rezKome.trim()) {
        alert('Proveri podatke!')
        setLoading(false)
        return
      }
      await Promise.all([
        supabase.from('artikli').update({ kolicina: rezArtikal.kolicina - rezKolicina }).eq('id', rezArtikal.id),
        supabase.from('rezervacije').insert({
          artikal_id: rezArtikal.id,
          kolicina: rezKolicina,
          kome: rezKome.trim(),
          napomena: rezNapomena.trim() || null,
        }),
      ])
      setArtikli((prev) =>
        prev.map((a) => (a.id === rezArtikal.id ? { ...a, kolicina: a.kolicina - rezKolicina } : a))
      )
      ucitajRezervacije()
      ucitajArtikle()
      alert(`Rezervisano ${rezKolicina} × ${rezArtikal.naziv} za "${rezKome}"`)
    } catch (err) {
      console.error('Greška pri rezervaciji:', err)
      alert('Greška pri rezervaciji!')
    } finally {
      setLoading(false)
      setShowRezervacija(false)
    }
  }

  async function razduziRezervaciju(rez: any, placeno: boolean) {
    setLoading(true)
    try {
      const osnovnaCena = rez.artikli?.osnovna_cena || artikli.find(a => a.id === rez.artikal_id)?.osnovna_cena || 0
      const zarada = osnovnaCena * rez.kolicina
      if (placeno) {
        await Promise.all([
          supabase.from('kasa').update({ stanje_zarada: stanjeKase + zarada }).eq('id', 1),
          supabase.from('prodaje').insert({
            artikal_id: rez.artikal_id,
            kolicina_prodato: rez.kolicina,
            cena_po_komadu: osnovnaCena,
            ukupna_zarada: zarada,
            prodavac_username: currentUser?.username,
            uloga_prodavac: currentUser?.uloga,
          }),
        ])
        setStanjeKase((prev) => prev + zarada)
        alert(`Plaćeno i razduženo: ${rez.kolicina} × ${rez.artikli.naziv}\nZarada: ${zarada.toFixed(2)} €`)
      } else {
        const artikal = artikli.find((a) => a.id === rez.artikal_id)
        if (artikal) {
          await supabase.from('artikli').update({ kolicina: artikal.kolicina + rez.kolicina }).eq('id', rez.artikal_id)
          setArtikli((prev) =>
            prev.map((a) => (a.id === rez.artikal_id ? { ...a, kolicina: a.kolicina + rez.kolicina } : a))
          )
        }
        alert(`Vraćeno na lager: ${rez.kolicina} × ${rez.artikli.naziv}`)
      }
      await supabase.from('rezervacije').update({ razduzeno: true }).eq('id', rez.id)
      ucitajRezervacije()
      ucitajArtikle()
      ucitajKasu()
    } catch (err) {
      console.error('Greška pri razduženju rezervacije:', err)
      alert('Greška pri razduženju!')
    } finally {
      setLoading(false)
    }
  }

  async function sacuvajArtikal(e: React.FormEvent) {
    e.preventDefault()
    if (currentUser?.uloga !== 'admin') return
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
        await supabase.from('artikli').update(payload).eq('id', editId)
        setEditId(null)
      } else {
        await supabase.from('artikli').insert(payload)
      }
      resetForme()
      ucitajArtikle()
      ucitajKasu()
      setShowForm(false)
    } catch (err) {
      console.error('Greška pri čuvanju artikal:', err)
      alert('Greška pri čuvanju!')
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
    setOsnovna(art.osnovna_cena.toString())
    setServiser(art.cena_serviser.toString())
    setKolega(art.cena_kolega.toString())
    setKolicina(art.kolicina.toString())
    setKategorija(art.kategorija || '')
    setUlazna(art.ulazna_cena?.toString() || '')
    setShowForm(true)
  }

  async function obrisiArtikal(id: string) {
    if (!confirm('Obrisati artikal?')) return
    try {
      await supabase.from('artikli').delete().eq('id', id)
      ucitajArtikle()
    } catch (err) {
      console.error('Greška pri brisanju artikla:', err)
      alert('Greška pri brisanju!')
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    await router.push('/login')
  }

  async function izvrsiResetKase() {
    if (resetCode !== '1234') {
      alert('Pogrešan kod!')
      return
    }
    setLoading(true)
    try {
      await supabase.from('kasa').update({ stanje_zarada: 0 }).eq('id', 1)
      setStanjeKase(0)
      alert('Kasa resetovana na 0 €')
      ucitajKasu()
    } catch (err) {
      console.error('Greška pri resetu kase:', err)
      alert('Greška pri resetu!')
    } finally {
      setLoading(false)
      setShowResetConfirm(false)
      setResetCode('')
    }
  }

  const isAdmin = currentUser?.uloga === 'admin'
  const artikliNaIzmaku = artikli.filter((a) => a.kolicina <= 1)

  const matchesPretraga = (naziv: string, pretraga: string): boolean => {
    if (!pretraga.trim()) return true
    const pretragaReči = pretraga.toLowerCase().trim().split(/\s+/)
    const nazivLower = naziv.toLowerCase()
    return pretragaReči.every(reč => nazivLower.includes(reč))
  }

  const filtrirani = artikli.filter((a) => {
    if (!isAdmin && a.kategorija && skrivenoZaOstale.includes(a.kategorija)) return false
    return matchesPretraga(a.naziv, pretraga) && (!filterKategorija || a.kategorija === filterKategorija)
  })

  const paginated = filtrirani.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filtrirani.length / perPage)
  const dostupneKategorije = kategorije.filter((k) => isAdmin || !skrivenoZaOstale.includes(k))

  const dohvatiIkonu = (kategorija: string | null) => {
    if (!kategorija) return CubeIcon
    if (kategorija.toUpperCase().includes('LCD')) return DevicePhoneMobileIcon
    if (kategorija.toUpperCase().includes('BATERIJE')) return Battery100Icon
    return CubeIcon
  }

  if (!currentUser) return <div className="p-10 text-center text-xl text-gray-900 dark:text-gray-100">Učitavanje korisnika...</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* HEADER */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6">
            <div className="flex items-center justify-between">
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
                  {currentUser.uloga.toUpperCase()}
                </span>
                <button
                  onClick={logout}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl px-5 py-3 flex items-center gap-2 transition shadow-md"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  <span className="font-medium">Odjavi se</span>
                </button>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="px-8 py-5 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-start gap-4">
                <a href="/admin/prodaje" className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 px-5 py-3 rounded-xl font-semibold transition shadow-sm">
                  <ChartBarIcon className="w-5 h-5" />
                  Pregled prodaja
                </a>
                <button onClick={() => setShowKriticniModal(true)} className="relative flex items-center gap-2 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/50 dark:hover:bg-orange-900/70 text-orange-700 dark:text-orange-300 px-5 py-3 rounded-xl font-semibold transition shadow-sm">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  Kritično stanje
                  {artikliNaIzmaku.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center animate-pulse shadow-lg">
                      {artikliNaIzmaku.length}
                    </span>
                  )}
                </button>
                <button onClick={() => setShowRezervisaniModal(true)} className="relative flex items-center gap-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-300 px-5 py-3 rounded-xl font-semibold transition shadow-sm">
                  <ClockIcon className="w-5 h-5" />
                  Rezervisani artikli
                  {rezervacije.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center shadow-lg">
                      {rezervacije.length}
                    </span>
                  )}
                </button>
                <button onClick={() => setShowVrednostPoKategorijama(true)} className="flex items-center gap-2 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/50 dark:hover:bg-teal-900/70 text-teal-700 dark:text-teal-300 px-5 py-3 rounded-xl font-semibold transition shadow-sm">
                  <ChartBarIcon className="w-5 h-5" />
                  Vrednost po kategorijama
                </button>
                <button
                  onClick={otvoriZaDodavanje}
                  className="ml-auto flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-7 py-3.5 rounded-xl font-bold text-lg transition shadow-xl transform hover:scale-105"
                >
                  <PlusIcon className="w-6 h-6" />
                  Dodaj novi artikal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* INFO BAR ISPOD HEADERA */}
        {isAdmin && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-2xl px-6 py-4 shadow-md flex-1 min-w-[220px]">
                  <div className="bg-indigo-600 dark:bg-indigo-500 rounded-xl p-3">
                    <CubeIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Vrednost lagera
                    </p>
                    <p className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-400">
                      {novacULageru.toFixed(2)} €
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl px-6 py-4 shadow-md flex-1 min-w-[220px]">
                  <div className="bg-green-600 dark:bg-green-500 rounded-xl p-3">
                    <CurrencyEuroIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Stanje kase
                    </p>
                    <p className="text-3xl font-extrabold text-green-700 dark:text-green-400">
                      {stanjeKase.toFixed(2)} €
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl px-6 py-4 shadow-md flex-1 min-w-[220px]">
                  <div className="bg-purple-600 dark:bg-purple-500 rounded-xl p-3">
                    <ShoppingBagIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Ukupno artikala
                    </p>
                    <p className="text-3xl font-extrabold text-purple-700 dark:text-purple-400">
                      {artikli.length}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl transition transform hover:scale-105 active:scale-95 flex items-center gap-3"
                  >
                    <TrashIcon className="w-6 h-6" />
                    Resetuj kasu
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pretraga + Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Pretraži artikle..."
              value={pretraga}
              onChange={(e) => {
                setPretraga(e.target.value)
                setPage(1)
              }}
              className="w-full pl-12 pr-6 py-4 border border-gray-300 dark:border-gray-600 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-500 shadow-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
            />
          </div>
          <select
            value={filterKategorija}
            onChange={(e) => {
              setFilterKategorija(e.target.value)
              setPage(1)
            }}
            className="px-6 py-4 border border-gray-300 dark:border-gray-600 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-500 shadow-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-w-[220px]"
          >
            <option value="">Sve kategorije</option>
            {dostupneKategorije.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* Lager lista */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <ShoppingBagIcon className="w-8 h-8" /> Lager ({filtrirani.length} artikala)
            </h2>
          </div>

          {/* Desktop tabela – sve cene vidljive */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="p-4 text-left">Artikal</th>
                  <th className="p-4 text-right">Nabavna cena</th>
                  <th className="p-4 text-right">Cena serviser</th>
                  <th className="p-4 text-right">Cena kolega</th>
                  <th className="p-4 text-right">Količina</th>
                  {isAdmin && <th className="p-4 text-center">Akcije</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.map((art) => {
                  const jeKriticno = art.kolicina <= 1
                  const jeUpozorenje = art.kolicina <= 3 && art.kolicina > 1
                  const Ikonica = dohvatiIkonu(art.kategorija)
                  return (
                    <tr key={art.id} className={`border-t transition ${jeKriticno ? 'bg-red-50 dark:bg-red-900/30' : jeUpozorenje ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      <td className="p-4 flex items-center gap-4">
                        <Ikonica className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-medium text-lg">{art.naziv}</span>
                      </td>
                      <td className="p-4 text-right text-xl font-medium">{art.osnovna_cena.toFixed(2)} €</td>
                      <td className="p-4 text-right text-xl font-medium text-orange-600 dark:text-orange-400">{art.cena_serviser.toFixed(2)} €</td>
                      <td className="p-4 text-right text-xl font-medium text-green-600 dark:text-green-400">{art.cena_kolega.toFixed(2)} €</td>
                      <td className={`p-4 text-right font-bold text-xl ${jeKriticno ? 'text-red-600' : jeUpozorenje ? 'text-orange-600' : ''}`}>
                        {art.kolicina}
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-center space-x-4">
                          <button onClick={() => otvoriProdaju(art)} className="text-green-600 hover:text-green-800"><ShoppingBagIcon className="w-6 h-6 inline" /></button>
                          <button onClick={() => otvoriRezervaciju(art)} className="text-orange-600 hover:text-orange-800"><ClockIcon className="w-6 h-6 inline" /></button>
                          <button onClick={() => izmeniArtikal(art)} className="text-blue-600 hover:text-blue-800"><PencilSquareIcon className="w-6 h-6 inline" /></button>
                          <button onClick={() => obrisiArtikal(art.id)} className="text-red-600 hover:text-red-800"><TrashIcon className="w-6 h-6 inline" /></button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

      {/* Mobilni prikaz – lep i pregledan */}
<div className="block lg:hidden space-y-5 px-2 pb-4">
  {paginated.map((art) => {
    const Ikonica = dohvatiIkonu(art.kategorija)
    const cenaInfo = currentUser?.uloga === 'kolega' ? { cena: art.cena_kolega, label: 'Cena kolega' } :
                    currentUser?.uloga === 'serviser' ? { cena: art.cena_serviser, label: 'Cena serviser' } :
                    currentUser?.uloga === 'lager' ? { cena: art.osnovna_cena, label: 'Nabavna cena' } :
                    { cena: art.osnovna_cena, label: 'Cena' }

    const jeKriticno = art.kolicina <= 1
    const jeUpozorenje = art.kolicina <= 3 && art.kolicina > 1

    return (
      <div
        key={art.id}
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border-2 transition-all ${
          jeKriticno ? 'border-red-500 shadow-red-500/20' :
          jeUpozorenje ? 'border-orange-500 shadow-orange-500/20' :
          'border-gray-200 dark:border-gray-700'
        }`}
      >
        {/* Gornji deo – naziv i ikona */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${jeKriticno ? 'bg-red-100 dark:bg-red-900/50' : jeUpozorenje ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-indigo-100 dark:bg-indigo-900/50'}`}>
              <Ikonica className={`w-8 h-8 ${jeKriticno ? 'text-red-600' : jeUpozorenje ? 'text-orange-600' : 'text-indigo-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
                {art.naziv}
              </h3>
              {art.kategorija && (
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                  {art.kategorija}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Donji deo – cena i količina */}
        <div className="px-5 py-5 bg-gray-50/70 dark:bg-gray-900/50">
          <div className="grid grid-cols-2 gap-6">
            {/* Cena – istaknuta */}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {cenaInfo.label}
              </p>
              <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
                {cenaInfo.cena.toFixed(2)} €
              </p>
            </div>

            {/* Količina – diskretnija */}
            <div className="text-center flex flex-col justify-center">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                Količina na lageru
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                jeKriticno ? 'text-red-600' :
                jeUpozorenje ? 'text-orange-600' :
                'text-gray-600 dark:text-gray-400'
              }`}>
                {art.kolicina}
              </p>
            </div>
          </div>
        </div>

        {/* Akcije – samo za admina */}
        {isAdmin && (
          <div className="px-5 py-4 bg-gray-100 dark:bg-gray-800/70 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-8">
            <button
              onClick={() => otvoriProdaju(art)}
              className="p-4 bg-green-100 dark:bg-green-900/50 rounded-xl hover:bg-green-200 dark:hover:bg-green-900/70 transition shadow-md"
            >
              <ShoppingBagIcon className="w-7 h-7 text-green-600 dark:text-green-400" />
            </button>
            <button
              onClick={() => otvoriRezervaciju(art)}
              className="p-4 bg-orange-100 dark:bg-orange-900/50 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/70 transition shadow-md"
            >
              <ClockIcon className="w-7 h-7 text-orange-600 dark:text-orange-400" />
            </button>
            <button
              onClick={() => izmeniArtikal(art)}
              className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/70 transition shadow-md"
            >
              <PencilSquareIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </button>
            <button
              onClick={() => obrisiArtikal(art.id)}
              className="p-4 bg-red-100 dark:bg-red-900/50 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/70 transition shadow-md"
            >
              <TrashIcon className="w-7 h-7 text-red-600 dark:text-red-400" />
            </button>
          </div>
        )}
      </div>
    )
  })}
</div>
          {/* Paginacija */}
          {totalPages > 1 && (
            <div className="p-6 border-t bg-gray-50 dark:bg-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition disabled:cursor-not-allowed"
              >
                ← Prethodna
              </button>
              <span className="text-lg font-medium">
                Strana {page} od {totalPages} ({filtrirani.length} artikala)
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition disabled:cursor-not-allowed"
              >
                Sledeća →
              </button>
            </div>
          )}
        </div>

        {/* MODAL ZA DODAVANJE / IZMENU */}
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
                      <h2 className="text-xl font-bold">
                        {editId ? 'Izmeni artikal' : 'Novi artikal'}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowForm(false)
                      setEditId(null)
                      resetForme()
                    }}
                    className="bg-white/20 hover:bg-white/30 rounded-xl p-2 transition"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* --- FORMA: footer tasteri SU SAD UNUTAR FORME (type="submit") --- */}
              <form onSubmit={sacuvajArtikal} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Naziv artikla
                  </label>
                  <input
                    required
                    value={naziv}
                    onChange={(e) => setNaziv(e.target.value)}
                    className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-purple-400 text-base"
                    placeholder="npr. iPhone 14 LCD Original"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Količina
                    </label>
                    <input
                      type="number"
                      required
                      value={kolicina}
                      onChange={(e) => setKolicina(e.target.value)}
                      className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Kategorija
                    </label>
                    <select
                      value={kategorija}
                      onChange={(e) => setKategorija(e.target.value)}
                      className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-indigo-400"
                    >
                      <option value="">Izaberi...</option>
                      {kategorije.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
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
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={osnovna}
                        onChange={(e) => setOsnovna(e.target.value)}
                        className="mt-1 w-full text-xl font-bold text-indigo-700 dark:text-indigo-400 bg-transparent text-center outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-2xl p-4 text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Serviser</p>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={serviser}
                        onChange={(e) => setServiser(e.target.value)}
                        className="mt-1 w-full text-xl font-bold text-orange-700 dark:text-orange-400 bg-transparent text-center outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl p-4 text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Kolega</p>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={kolega}
                        onChange={(e) => setKolega(e.target.value)}
                        className="mt-1 w-full text-xl font-bold text-green-700 dark:text-green-400 bg-transparent text-center outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Ulazna cena (opcionalno)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={ulazna}
                      onChange={(e) => setUlazna(e.target.value)}
                      className="mt-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-yellow-400"
                      placeholder="0.00 €"
                    />
                  </div>
                  {ulazna && osnovna && Number(ulazna) > 0 && Number(osnovna) > 0 && (
                    <div className="flex justify-center">
                      <div className="bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-600 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm">
                        Marža: <span className="font-bold text-yellow-700 dark:text-yellow-400">
                          {(Number(osnovna) - Number(ulazna)).toFixed(2)} €
                        </span>
                        {' '}({((Number(osnovna) / Number(ulazna) - 1) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  )}
                </div>

                {/* footer UNUTAR forme - submit button će aktivirati onSubmit */}
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-3xl">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false)
                        setEditId(null)
                        resetForme()
                      }}
                      className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl font-medium transition"
                    >
                      Otkaži
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-70 text-white rounded-xl font-bold transition shadow-md"
                    >
                      {loading ? 'Čuvam...' : editId ? 'Sačuvaj' : 'Dodaj artikal'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL ZA PRODAJU */}
        {showProdaja && prodajaArtikal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <ShoppingBagIcon className="w-7 h-7 text-green-600" />
                  Prodaja
                </h3>
                <button onClick={() => setShowProdaja(false)} className="text-gray-500 hover:text-gray-700">
                  <XMarkIcon className="w-7 h-7" />
                </button>
              </div>
              <p className="text-lg font-semibold text-center mb-5 text-gray-900 dark:text-gray-100">
                {prodajaArtikal.naziv}
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg py-3 px-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Ulazna</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {prodajaArtikal.ulazna_cena > 0 ? prodajaArtikal.ulazna_cena.toFixed(2) : '—'} €
                  </p>
                </div>
                <div className="bg-indigo-100 dark:bg-indigo-900/40 rounded-lg py-3 px-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Nabavna</p>
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                    {prodajaArtikal.osnovna_cena.toFixed(2)} €
                  </p>
                </div>
                {prodajaArtikal.ulazna_cena > 0 && (
                  <div className="bg-yellow-100 dark:bg-yellow-900/50 rounded-lg py-3 px-2 border border-yellow-500 dark:border-yellow-600">
                    <p className="text-xs text-gray-700 dark:text-gray-300">Marža</p>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">
                      {(prodajaArtikal.osnovna_cena - prodajaArtikal.ulazna_cena).toFixed(2)} €
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Količina (lager: {prodajaArtikal.kolicina})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={prodajaArtikal.kolicina}
                    value={prodajaKolicina}
                    onChange={(e) => setProdajaKolicina(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Cena po komadu (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodajaCena}
                    onChange={(e) => setProdajaCena(Number(e.target.value))}
                    placeholder={prodajaArtikal.osnovna_cena.toFixed(2)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-400"
                  />
                </div>
                {prodajaKolicina > 0 && prodajaCena > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Zarada</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {(prodajaCena * prodajaKolicina).toFixed(2)} €
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowProdaja(false)}
                  className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition"
                >
                  Otkaži
                </button>
                <button
                  onClick={izvrsiProdaju}
                  disabled={loading || prodajaKolicina < 1 || prodajaKolicina > prodajaArtikal.kolicina}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition"
                >
                  {loading ? 'Prodajem...' : 'Prodaj'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ... ostatak modala (rezervacija, kritično stanje, rezervisani, vrednost po kategorijama, reset kase) ostaje isti kao u originalnom kodu ... */}

        {/* MODAL ZA REZERVACIJU */}
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
              <p className="text-gray-600 mb-4">Na lageru: <strong>{rezArtikal.kolicina}</strong></p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Količina</label>
                  <input type="number" min="1" max={rezArtikal.kolicina} value={rezKolicina} onChange={e => setRezKolicina(Number(e.target.value))} className="w-full px-4 py-3 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Za koga</label>
                  <input type="text" required value={rezKome} onChange={e => setRezKome(e.target.value)} placeholder="Ime, servis..." className="w-full px-4 py-3 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Napomena (opcionalno)</label>
                  <textarea rows={3} value={rezNapomena} onChange={e => setRezNapomena(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button onClick={() => setShowRezervacija(false)} className="flex-1 py-3 bg-gray-300 hover:bg-gray-400 rounded-lg">Otkaži</button>
                <button onClick={sacuvajRezervaciju} disabled={loading} className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-70">
                  {loading ? 'Rezervišem...' : 'Rezerviši'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* (Ostali modali su već u ovom fajlu iznad u originalnom kodu — zadržao sam ih neizmenjene osim dodavanja console.error u catch-evima) */}

        {/* MODAL ZA KRITIČNO STANJE */}
        {showKriticniModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-6 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-red-600 flex items-center gap-3">
                  <ExclamationTriangleIcon className="w-8 h-8" />
                  Kritična stanja ({artikliNaIzmaku.length})
                </h3>
                <button onClick={() => setShowKriticniModal(false)}><XMarkIcon className="w-8 h-8" /></button>
              </div>
              <div className="p-6">
                {artikliNaIzmaku.length === 0 ? (
                  <p className="text-center py-10 text-gray-600">Sve je OK! 👍</p>
                ) : (
                  <div className="space-y-4">
                    {artikliNaIzmaku.map(art => {
                      const Ikonica = dohvatiIkonu(art.kategorija)
                      return (
                        <div key={art.id} className="bg-red-50 dark:bg-red-900/30 rounded-lg p-6 flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <Ikonica className="w-12 h-12 text-red-600" />
                            <div>
                              <p className="text-xl font-bold">{art.naziv}</p>
                              <p className="text-2xl font-bold text-red-600">Količina: {art.kolicina}</p>
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

        {/* MODAL ZA REZERVISANE ARTIKLE */}
        {showRezervisaniModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-6 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-purple-600 flex items-center gap-3">
                  <ClockIcon className="w-8 h-8" />
                  Rezervisani artikli ({rezervacije.length})
                </h3>
                <button onClick={() => setShowRezervisaniModal(false)}><XMarkIcon className="w-8 h-8" /></button>
              </div>
              <div className="p-6">
                {rezervacije.length === 0 ? (
                  <p className="text-center py-10 text-gray-600">Nema aktivnih rezervacija.</p>
                ) : (
                  <div className="space-y-4">
                    {rezervacije.map(rez => (
                      <div key={rez.id} className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xl font-bold">{rez.artikli?.naziv || 'Nepoznat artikal'}</p>
                            <p>Količina: <strong>{rez.kolicina}</strong></p>
                            <p>Za: <strong>{rez.kome}</strong></p>
                            {rez.napomena && <p className="text-sm text-gray-600 mt-2">Napomena: {rez.napomena}</p>}
                            <p className="text-sm text-gray-500 mt-2">Datum: {new Date(rez.datum_rezervacije).toLocaleString('sr-RS')}</p>
                          </div>
                          <div className="flex flex-col gap-3">
                            <button onClick={() => razduziRezervaciju(rez, true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
                              Plaćeno
                            </button>
                            <button onClick={() => razduziRezervaciju(rez, false)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">
                              Vrati na lager
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL ZA VREDNOST PO KATEGORIJAMA */}
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
                  const vrednost = artikliKat.reduce((sum, a) => sum + a.osnovna_cena * a.kolicina, 0)
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

        {/* MODAL ZA RESET KASE */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
              <h3 className="text-2xl font-bold text-red-600 mb-6 text-center">Reset kase na 0 €?</h3>
              <input
                type="password"
                placeholder="Unesi kod (1234)"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full px-5 py-4 border border-gray-300 dark:border-gray-600 rounded-xl text-lg mb-6 focus:ring-4 focus:ring-red-400"
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowResetConfirm(false)
                    setResetCode('')
                  }}
                  className="flex-1 py-4 bg-gray-300 hover:bg-gray-400 rounded-xl font-bold transition"
                >
                  Otkaži
                </button>
                <button
                  onClick={izvrsiResetKase}
                  disabled={loading}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white rounded-xl font-bold transition"
                >
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