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
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'

// Moguće uloge korisnika
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

  // Forma za dodavanje/izmjenu
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [naziv, setNaziv] = useState('')
  const [osnovna, setOsnovna] = useState('')
  const [serviser, setServiser] = useState('')
  const [kolega, setKolega] = useState('')
  const [kolicina, setKolicina] = useState('')
  const [kategorija, setKategorija] = useState('')
  const [createdAt, setCreatedAt] = useState('') // Za prikaz datuma unosa
  const [poruka, setPoruka] = useState('')

  // Prodaja modal
  const [showProdaja, setShowProdaja] = useState(false)
  const [prodajaArtikal, setProdajaArtikal] = useState<any | null>(null)
  const [prodajaKolicina, setProdajaKolicina] = useState(1)
  const [prodajaCena, setProdajaCena] = useState(0) // Novo: ručna cena za prodaju

  // Rezervacija modal
  const [showRezervacija, setShowRezervacija] = useState(false)
  const [rezArtikal, setRezArtikal] = useState<any | null>(null)
  const [rezKolicina, setRezKolicina] = useState(1)
  const [rezKome, setRezKome] = useState('')
  const [rezNapomena, setRezNapomena] = useState('')

  // Reset kase
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetCode, setResetCode] = useState('')

  // Modali za obaveštenja
  const [showKriticniModal, setShowKriticniModal] = useState(false)
  const [showRezervisaniModal, setShowRezervisaniModal] = useState(false)

  // Paginacija
  const [page, setPage] = useState(1)
  const perPage = 30

  const kategorije = [
    'SAMSUNG LCD',
    'IPHONE LCD KOPIJA',
    'IPHONE LCD ORG',
    'BATERIJE IPHONE',
    'BATERIJE VERIFY',
    'Ostalo',
  ]

  // KATEGORIJE KOJE VIDI SAMO ADMIN
  const skrivenoZaOstale = ['BATERIJE IPHONE', 'BATERIJE VERIFY']

  // Boje za uloge
  const ulogaBoja: Record<Uloga, string> = {
    admin: 'bg-indigo-600',
    kolega: 'bg-green-600',
    serviser: 'bg-orange-600',
    lager: 'bg-gray-600',
  }

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('username, uloga')
      .eq('id', user.id)
      .single()
    if (error || !data) {
      await supabase.auth.signOut()
      router.push('/login')
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

  // Realtime za rezervacije (samo za admina)
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
    ucitajKasu()
  }, [])

  useEffect(() => {
    if (currentUser?.uloga === 'admin') {
      ucitajRezervacije()
    }
  }, [currentUser])

  // Prodaja
  function otvoriProdaju(artikal: any) {
    setProdajaArtikal(artikal)
    setProdajaKolicina(1)
    setProdajaCena(artikal.osnovna_cena) // Podrazumevana cena = nabavna
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
      const zarada = prodajaCena * prodajaKolicina // Koristi ručnu cenu!
      await Promise.all([
        supabase.from('artikli').update({ kolicina: prodajaArtikal.kolicina - prodajaKolicina }).eq('id', prodajaArtikal.id),
        supabase.from('prodaje').insert({
          artikal_id: prodajaArtikal.id,
          kolicina_prodato: prodajaKolicina,
          cena_po_komadu: prodajaCena, // Čuvaj ručnu cenu u bazi
          ukupna_zarada: zarada,
          prodavac_username: currentUser?.username,
          uloga_prodavac: 'admin',
        }),
        supabase.from('kasa').update({ stanje_zarada: stanjeKase + zarada }).eq('id', 1),
      ])
      setArtikli((prev) =>
        prev.map((a) => (a.id === prodajaArtikal.id ? { ...a, kolicina: a.kolicina - prodajaKolicina } : a))
      )
      setStanjeKase((prev) => prev + zarada)
      alert(`Prodato ${prodajaKolicina} × ${prodajaArtikal.naziv} po ceni ${prodajaCena} €/kom\nZarada: ${zarada.toFixed(2)} €`)
    } catch (err) {
      alert('Greška pri prodaji!')
      console.error(err)
    } finally {
      setLoading(false)
      setShowProdaja(false)
    }
  }

  // Rezervacija
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
      alert(`Rezervisano ${rezKolicina} × ${rezArtikal.naziv} za "${rezKome}"`)
    } catch (err) {
      alert('Greška pri rezervaciji!')
      console.error(err)
    } finally {
      setLoading(false)
      setShowRezervacija(false)
    }
  }

  async function razduziRezervaciju(rez: any, placeno: boolean) {
    setLoading(true)
    try {
      if (placeno) {
        const zarada = rez.artikli.osnovna_cena * rez.kolicina
        await Promise.all([
          supabase.from('kasa').update({ stanje_zarada: stanjeKase + zarada }).eq('id', 1),
          supabase.from('prodaje').insert({
            artikal_id: rez.artikal_id,
            kolicina_prodato: rez.kolicina,
            cena_po_komadu: rez.artikli.osnovna_cena,
            ukupna_zarada: zarada,
            prodavac_username: currentUser?.username,
            uloga_prodavac: 'admin',
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
    } catch (err) {
      alert('Greška!')
    } finally {
      setLoading(false)
    }
  }

  // Reset kase
  function otvoriResetConfirm() {
    setShowResetConfirm(true)
    setResetCode('')
  }

  async function izvrsiResetKase() {
    if (resetCode !== '1234') {
      alert('Pogrešan kod! Reset otkazan.')
      return
    }
    setLoading(true)
    try {
      await supabase.from('kasa').update({ stanje_zarada: 0 }).eq('id', 1)
      setStanjeKase(0)
      alert('Kasa uspešno resetovana na 0 €')
    } catch (err) {
      alert('Greška pri resetu kase!')
    } finally {
      setLoading(false)
      setShowResetConfirm(false)
    }
  }

  // Dodavanje/izmena artikla
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
      }
      if (editId) {
        await supabase.from('artikli').update(payload).eq('id', editId)
        setEditId(null)
      } else {
        await supabase.from('artikli').insert(payload)
      }
      setPoruka(editId ? 'Izmenjeno!' : 'Dodato!')
      resetForme()
      ucitajArtikle()
    } catch (err) {
      alert('Greška pri čuvanju!')
    } finally {
      setLoading(false)
      setShowForm(false)
    }
  }

  function resetForme() {
    setNaziv('')
    setOsnovna('')
    setServiser('')
    setKolega('')
    setKolicina('')
    setKategorija('')
    setCreatedAt('')
    setPoruka('')
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
    setCreatedAt(art.created_at)
    setShowForm(true)
  }

  async function obrisiArtikal(id: string) {
    if (!confirm('Obrisati artikal?')) return
    await supabase.from('artikli').delete().eq('id', id)
    ucitajArtikle()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Definisanje uloga PRE filtriranja
  const isAdmin = currentUser?.uloga === 'admin'
  const isKolega = currentUser?.uloga === 'kolega'
  const isServiser = currentUser?.uloga === 'serviser'
  const isLager = currentUser?.uloga === 'lager'

  const prikaziCenuKolega = isAdmin || isKolega
  const prikaziCenuServiser = isAdmin || isServiser
  const prikaziOsnovnu = isAdmin || isLager

  const artikliNaIzmaku = artikli.filter((a) => a.kolicina <= 1)

  // Filtriranje sa skrivenim kategorijama
  const filtrirani = artikli.filter((a) => {
    if (!isAdmin && a.kategorija && skrivenoZaOstale.includes(a.kategorija)) {
      return false
    }
    return (
      a.naziv.toLowerCase().includes(pretraga.toLowerCase()) &&
      (!filterKategorija || a.kategorija === filterKategorija)
    )
  })

  const paginated = filtrirani.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filtrirani.length / perPage)

  if (!currentUser) return <div className="p-10 text-center text-xl">Učitavanje korisnika...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 rounded-xl shadow-lg gap-4">
          <div className="flex items-center gap-4">
            <CubeIcon className="w-10 h-10 text-white" />
            <div>
              <h1 className="text-2xl font-bold">Magacin v1.0</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-lg">Ulogovan: {currentUser.username}</span>
                <span className={`px-4 py-1 rounded-full text-white font-semibold ${ulogaBoja[currentUser.uloga] || 'bg-gray-600'}`}>
                  {currentUser.uloga.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <>
                <a href="/admin/prodaje" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition">
                  <ChartBarIcon className="w-5 h-5" />
                  Pregled prodaja
                </a>
                <button onClick={() => setShowKriticniModal(true)} className="relative flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg font-medium transition">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  Kritično stanje
                  {artikliNaIzmaku.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg animate-pulse">
                      {artikliNaIzmaku.length}
                    </span>
                  )}
                </button>
                <button onClick={() => setShowRezervisaniModal(true)} className="relative flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-medium transition">
                  <ClockIcon className="w-5 h-5" />
                  Rezervisani artikli
                  {rezervacije.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-yellow-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
                      {rezervacije.length}
                    </span>
                  )}
                </button>
              </>
            )}
            <button onClick={logout} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-medium transition">
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Odjavi se
            </button>
          </div>
        </div>

        {/* Statistika */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Vrednost lagera</p>
                  <p className="text-3xl font-bold mt-2">{novacULageru.toFixed(2)} €</p>
                </div>
                <CubeIcon className="w-12 h-12 text-blue-200" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">Stanje kase</p>
                  <p className="text-3xl font-bold mt-2">{stanjeKase.toFixed(2)} €</p>
                </div>
                <CurrencyEuroIcon className="w-12 h-12 text-green-200" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl text-white shadow-lg flex items-center justify-center">
              <button onClick={otvoriResetConfirm} className="flex items-center gap-3 bg-white/20 hover:bg-white/30 px-8 py-4 rounded-lg font-bold transition w-full justify-center">
                <ArrowPathIcon className="w-6 h-6" /> Resetuj kasu
              </button>
            </div>
          </div>
        )}

        {/* Pretraga + kategorije */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Pretraži artikle..."
              value={pretraga}
              onChange={(e) => {
                setPretraga(e.target.value)
                setPage(1)
              }}
              className="w-full pl-12 pr-6 py-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 shadow-md"
            />
          </div>
          <select
            value={filterKategorija}
            onChange={(e) => {
              setFilterKategorija(e.target.value)
              setPage(1)
            }}
            className="p-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 shadow-md"
          >
            <option value="">Sve kategorije</option>
            {kategorije
              .filter((k) => isAdmin || !skrivenoZaOstale.includes(k))
              .map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        </div>

        {/* Forma za dodavanje/izmenu */}
        {isAdmin && (
          <div className="mb-10">
            {!showForm ? (
              <button
                onClick={otvoriZaDodavanje}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-8 rounded-lg font-bold transition flex items-center gap-3 shadow-lg"
              >
                <PlusIcon className="w-6 h-6" />
                Dodaj novi artikal
              </button>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                  <PlusIcon className="w-8 h-8 text-indigo-600" />
                  {editId ? 'Izmeni artikal' : 'Dodaj novi artikal'}
                </h2>
                <form onSubmit={sacuvajArtikal} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Naziv artikla</label>
                    <input value={naziv} onChange={(e) => setNaziv(e.target.value)} required className="w-full p-4 border rounded-lg focus:ring-4 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nabavna cena (€)</label>
                    <input type="number" value={osnovna} onChange={(e) => setOsnovna(e.target.value)} required className="w-full p-4 border rounded-lg focus:ring-4 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cena za serviser (€)</label>
                    <input type="number" value={serviser} onChange={(e) => setServiser(e.target.value)} required className="w-full p-4 border rounded-lg focus:ring-4 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cena za kolegu (€)</label>
                    <input type="number" value={kolega} onChange={(e) => setKolega(e.target.value)} required className="w-full p-4 border rounded-lg focus:ring-4 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Količina</label>
                    <input type="number" value={kolicina} onChange={(e) => setKolicina(e.target.value)} required className="w-full p-4 border rounded-lg focus:ring-4 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategorija</label>
                    <select value={kategorija} onChange={(e) => setKategorija(e.target.value)} className="w-full p-4 border rounded-lg focus:ring-4 focus:ring-indigo-300">
                      <option value="">Izaberi kategoriju</option>
                      {kategorije.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Datum unosa – samo u režimu izmene */}
                  {editId && createdAt && (
                    <div className="lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Datum unosa</label>
                      <div className="flex items-center gap-2 text-gray-600 bg-gray-100 p-4 rounded-lg">
                        <CalendarIcon className="w-5 h-5" />
                        <span><strong>{new Date(createdAt).toLocaleDateString('sr-RS')}</strong></span>
                      </div>
                    </div>
                  )}

                  <div className="lg:col-span-3 flex gap-4">
                    <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-8 rounded-lg font-bold transition flex items-center gap-3">
                      <PlusIcon className="w-6 h-6" />
                      {loading ? 'Čuvanje...' : editId ? 'Sačuvaj izmene' : 'Dodaj artikal'}
                    </button>
                    <button type="button" onClick={() => { setShowForm(false); resetForme() }} className="bg-gray-600 hover:bg-gray-700 text-white py-4 px-8 rounded-lg font-bold transition">
                      Otkaži
                    </button>
                  </div>
                </form>
                {poruka && <p className="mt-6 text-center text-green-600 text-xl font-semibold">{poruka}</p>}
                <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-lg mb-3">Objašnjenje cena po ulogama:</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2"><span className="font-medium text-green-600">Kolega:</span> vidi cene sa ugradnjom</li>
                    <li className="flex items-start gap-2"><span className="font-medium text-orange-600">Serviser:</span> vidi cene bez ugradnje</li>
                    <li className="flex items-start gap-2"><span className="font-medium text-gray-600">Lager:</span> vidi nabavne cene ekrana</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lager lista */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <ShoppingBagIcon className="w-8 h-8" /> Lager ({filtrirani.length} artikala)
            </h2>
          </div>

          {/* Mobilni prikaz */}
          <div className="block lg:hidden">
            {paginated.map((art) => (
              <div key={art.id} className="border-b border-gray-200 p-4 hover:bg-gray-50 transition">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{art.naziv}</h3>
                  {isAdmin && (
                    <div className="flex gap-3">
                      <button onClick={() => otvoriProdaju(art)} className="text-green-600 hover:text-green-800"><ShoppingBagIcon className="w-6 h-6" /></button>
                      <button onClick={() => otvoriRezervaciju(art)} className="text-orange-600 hover:text-orange-800"><ClockIcon className="w-6 h-6" /></button>
                      <button onClick={() => izmeniArtikal(art)} className="text-blue-600 hover:text-blue-800"><PencilSquareIcon className="w-6 h-6" /></button>
                      <button onClick={() => obrisiArtikal(art.id)} className="text-red-600 hover:text-red-800"><TrashIcon className="w-6 h-6" /></button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                  {prikaziOsnovnu && <div><span className="font-medium">Nabavna:</span> {art.osnovna_cena} €</div>}
                  {prikaziCenuServiser && <div><span className="font-medium">Serviser:</span> {art.cena_serviser} €</div>}
                  {prikaziCenuKolega && <div><span className="font-medium">Kolega:</span> {art.cena_kolega} €</div>}
                  <div className={`font-bold text-xl col-span-2 mt-3 ${art.kolicina <= 1 ? 'text-red-600' : ''}`}>
                    Količina: {art.kolicina}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop tabela */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 text-left">Naziv</th>
                  {prikaziOsnovnu && <th className="p-4 text-right">Nabavna</th>}
                  {prikaziCenuServiser && <th className="p-4 text-right">Serviser</th>}
                  {prikaziCenuKolega && <th className="p-4 text-right">Kolega</th>}
                  <th className="p-4 text-right">Količina</th>
                  {isAdmin && <th className="p-4 text-center">Akcije</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.map((art) => (
                  <tr key={art.id} className="border-t hover:bg-gray-50 transition">
                    <td className="p-4 font-medium">{art.naziv}</td>
                    {prikaziOsnovnu && <td className="p-4 text-right">{art.osnovna_cena} €</td>}
                    {prikaziCenuServiser && <td className="p-4 text-right">{art.cena_serviser} €</td>}
                    {prikaziCenuKolega && <td className="p-4 text-right">{art.cena_kolega} €</td>}
                    <td className={`p-4 text-right font-bold text-lg ${art.kolicina <= 1 ? 'text-red-600' : ''}`}>
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginacija */}
          {totalPages > 1 && (
            <div className="p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition disabled:cursor-not-allowed"
              >
                ← Prethodna
              </button>
              <span className="text-lg font-medium">
                Strana {page} od {totalPages} ({filtrirani.length} artikala)
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition disabled:cursor-not-allowed"
              >
                Sledeća →
              </button>
            </div>
          )}
        </div>

        {/* Modal za prodaju – sa novim poljem za ručnu cenu */}
        {showProdaja && prodajaArtikal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <ShoppingBagIcon className="w-8 h-8 text-green-600" />
                  Prodaja artikla
                </h2>
                <button onClick={() => setShowProdaja(false)} className="text-gray-500 hover:text-gray-700">
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-lg font-semibold">{prodajaArtikal.naziv}</p>
                <p className="text-gray-600">Na lageru: <span className="font-bold">{prodajaArtikal.kolicina}</span></p>
                <p className="text-gray-600 mt-2">Podrazumevana nabavna cena: <span className="font-bold">{prodajaArtikal.osnovna_cena} €</span></p>
              </div>
              <div className="mb-8 space-y-6">
                <div>
                  <label className="block text-lg font-medium mb-3">Količina:</label>
                  <input
                    type="number"
                    min="1"
                    max={prodajaArtikal.kolicina}
                    value={prodajaKolicina}
                    onChange={(e) => setProdajaKolicina(Math.min(Number(e.target.value) || 1, prodajaArtikal.kolicina))}
                    className="w-full p-4 border-2 border-gray-300 rounded-lg text-xl text-center"
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium mb-3">Cena po komadu (€):</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prodajaCena}
                    onChange={(e) => setProdajaCena(Number(e.target.value))}
                    className="w-full p-4 border-2 border-gray-300 rounded-lg text-xl text-center focus:border-green-500"
                  />
                </div>
                <p className="text-right text-lg">
                  Zarada: <span className="font-bold text-green-600">{(prodajaCena * prodajaKolicina).toFixed(2)} €</span>
                </p>
              </div>
              <div className="flex gap-4">
                <button onClick={izvrsiProdaju} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 px-8 rounded-lg font-bold transition flex items-center justify-center gap-3">
                  <ShoppingBagIcon className="w-6 h-6" />
                  {loading ? 'Prodaja u toku...' : 'Prodaj'}
                </button>
                <button onClick={() => setShowProdaja(false)} disabled={loading} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 px-8 rounded-lg font-bold transition">
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ostali modali (rezervacija, kritični, rezervisani, reset) – nepromenjeni */}
        {showRezervacija && rezArtikal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <ClockIcon className="w-8 h-8 text-orange-600" />
                  Rezerviši artikal
                </h2>
                <button onClick={() => setShowRezervacija(false)} className="text-gray-500 hover:text-gray-700">
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-lg font-semibold">{rezArtikal.naziv}</p>
                <p className="text-gray-600">Na lageru: <span className="font-bold">{rezArtikal.kolicina}</span></p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-lg font-medium mb-2">Količina:</label>
                  <input
                    type="number"
                    min="1"
                    max={rezArtikal.kolicina}
                    value={rezKolicina}
                    onChange={(e) => setRezKolicina(Math.min(Number(e.target.value) || 1, rezArtikal.kolicina))}
                    className="w-full p-4 border-2 border-gray-300 rounded-lg text-xl text-center"
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium mb-2">Kome je dat:</label>
                  <input type="text" value={rezKome} onChange={(e) => setRezKome(e.target.value)} placeholder="Ime mušterije/kolege" className="w-full p-4 border-2 border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-lg font-medium mb-2">Napomena (opcionalno):</label>
                  <textarea value={rezNapomena} onChange={(e) => setRezNapomena(e.target.value)} placeholder="Npr. za sutra, probati kod kuće..." className="w-full p-4 border-2 border-gray-300 rounded-lg" rows={3} />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button onClick={sacuvajRezervaciju} disabled={loading} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-4 px-8 rounded-lg font-bold transition flex items-center justify-center gap-3">
                  <ClockIcon className="w-6 h-6" />
                  {loading ? 'Rezervacija u toku...' : 'Rezerviši'}
                </button>
                <button onClick={() => setShowRezervacija(false)} disabled={loading} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 px-8 rounded-lg font-bold transition">
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        )}

        {showKriticniModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-red-600 flex items-center gap-3">
                  <ExclamationTriangleIcon className="w-8 h-8" />
                  Kritično stanje lagera ({artikliNaIzmaku.length})
                </h2>
                <button onClick={() => setShowKriticniModal(false)} className="text-gray-500 hover:text-gray-700">
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>
              {artikliNaIzmaku.length === 0 ? (
                <p className="text-center text-gray-600 py-8 text-lg">Svi artikli su na zadovoljavajućem stanju. 👍</p>
              ) : (
                <div className="grid gap-4">
                  {artikliNaIzmaku.map((art) => (
                    <div key={art.id} className="bg-red-50 p-4 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-lg">{art.naziv}</p>
                        <p className="text-red-600 font-bold">Količina: {art.kolicina}</p>
                      </div>
                      <button onClick={() => { setShowKriticniModal(false); izmeniArtikal(art) }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
                        Dopuni
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showRezervisaniModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-purple-600 flex items-center gap-3">
                  <ClockIcon className="w-8 h-8" />
                  Rezervisani artikli ({rezervacije.length})
                </h2>
                <button onClick={() => setShowRezervisaniModal(false)} className="text-gray-500 hover:text-gray-700">
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>
              {rezervacije.length === 0 ? (
                <p className="text-center text-gray-600 py-8 text-lg">Nema aktivnih rezervacija.</p>
              ) : (
                <div className="grid gap-4">
                  {rezervacije.map((rez) => (
                    <div key={rez.id} className="bg-purple-50 p-4 rounded-lg flex flex-col gap-2">
                      <p className="font-semibold text-lg">{rez.kolicina} × {rez.artikli.naziv}</p>
                      <p>Dat: <span className="font-medium">{rez.kome}</span></p>
                      {rez.napomena && <p className="italic">"{rez.napomena}"</p>}
                      <p className="text-sm text-gray-500">Datum: {new Date(rez.datum_rezervacije).toLocaleDateString('sr-RS')}</p>
                      <div className="flex gap-3 mt-3">
                        <button onClick={() => { setShowRezervisaniModal(false); razduziRezervaciju(rez, true) }} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition">
                          Plaćeno
                        </button>
                        <button onClick={() => { setShowRezervisaniModal(false); razduziRezervaciju(rez, false) }} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition">
                          Vrati na lager
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-red-600 mb-6">Potvrda resetovanja kase</h2>
              <p className="text-lg mb-6">Unesi sigurnosni kod za potvrdu:</p>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="Unesi kod (1234)"
                className="w-full p-4 border-2 border-red-300 rounded-lg text-xl text-center mb-6"
                autoFocus
              />
              <div className="flex gap-4">
                <button onClick={izvrsiResetKase} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold transition">
                  {loading ? 'Reset u toku...' : 'Potvrdi reset'}
                </button>
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 px-8 rounded-lg font-bold transition">
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}