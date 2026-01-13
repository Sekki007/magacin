'use client'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  CurrencyEuroIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

export default function PregledProdaja() {
  const router = useRouter()
  const [prodaje, setProdaje] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [pretraga, setPretraga] = useState('')
  const [datumOd, setDatumOd] = useState('')
  const [datumDo, setDatumDo] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 20
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [loadingReset, setLoadingReset] = useState(false)
  const [loading, setLoading] = useState(true)

  // Stati za edit/storno modale
  const [editModal, setEditModal] = useState(false)
  const [stornoModal, setStornoModal] = useState(false)
  const [selectedProdaja, setSelectedProdaja] = useState<any>(null)
  const [novaCena, setNovaCena] = useState(0)
  const [novaUlaznaCena, setNovaUlaznaCena] = useState<number | ''>('')
  const [stornoRazlog, setStornoRazlog] = useState('')
  const [loadingAction, setLoadingAction] = useState(false)

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('uloga')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile || profile.uloga !== 'admin') {
        router.push('/')
        return
      }

      setCurrentUser(profile)
      await ucitajProdaje()
      setLoading(false)
    }
    init()
  }, [])

  const ucitajProdaje = async () => {
    const { data: p, error } = await supabase
      .from('prodaje')
      .select('*, artikli(naziv, osnovna_cena, ulazna_cena, kolicina)')
      .order('datum', { ascending: false })

    if (!error) {
      setProdaje(p || [])
    } else {
      console.error('Greška pri učitavanju:', error)
    }
  }

  const filtered = useMemo(() => {
    let temp = [...prodaje]
    if (pretraga) {
      const lowerPretraga = pretraga.toLowerCase()
      temp = temp.filter((p) =>
        p.artikli?.naziv?.toLowerCase().includes(lowerPretraga) ||
        p.prodavac_username?.toLowerCase().includes(lowerPretraga)
      )
    }
    if (datumOd) {
      const odDate = new Date(datumOd)
      odDate.setHours(0, 0, 0, 0)
      temp = temp.filter((p) => new Date(p.datum) >= odDate)
    }
    if (datumDo) {
      const doDate = new Date(datumDo)
      doDate.setHours(23, 59, 59, 999)
      temp = temp.filter((p) => new Date(p.datum) <= doDate)
    }
    return temp
  }, [prodaje, pretraga, datumOd, datumDo])

 // računamo samo NE-stornirane stavke
const ukupnaZarada = useMemo(() => {
  return filtered
    .filter(p => p.status !== 'stornirana')
    .reduce((sum, p) => sum + (p.ukupna_zarada || 0), 0)
}, [filtered])

const ukupnaRealnaMarza = useMemo(() => {
  return filtered
    .filter(p => p.status !== 'stornirana')
    .reduce((sum, p) => {
      const ulazna = p.artikli?.ulazna_cena || 0
      const prodajna = p.cena_po_komadu || 0
      const kolicina = p.kolicina_prodato || 0
      return sum + (prodajna - ulazna) * kolicina
    }, 0)
}, [filtered])

  const paginated = useMemo(() =>
    filtered.slice((page - 1) * perPage, page * perPage), [filtered, page, perPage]
  )

  const totalPages = useMemo(() =>
    Math.ceil(filtered.length / perPage), [filtered.length, perPage]
  )

  useEffect(() => {
    setPage(1)
  }, [pretraga, datumOd, datumDo])

  // CSV Export
  const exportCSV = useCallback(() => {
    const headers = [
      'Datum', 'Artikal', 'Ulazna cena', 'Prodajna cena', 'Marža/kom', 'Količina',
      'Ukupno naplaćeno', 'Ukupna marža', 'Prodao'
    ]
    const rows = filtered.map((p) => {
      const ulazna = p.artikli?.ulazna_cena || 0
      const prodajna = p.cena_po_komadu || 0
      const marzaPoKom = prodajna - ulazna
      const ukupnaMarza = marzaPoKom * (p.kolicina_prodato || 0)
      return [
        new Date(p.datum).toLocaleString('sr-RS'),
        `"${p.artikli?.naziv || 'Nepoznato'}"`,
        ulazna.toFixed(2),
        prodajna.toFixed(2),
        marzaPoKom.toFixed(2),
        p.kolicina_prodato || 0,
        (p.ukupna_zarada || 0).toFixed(2),
        ukupnaMarza.toFixed(2),
        `${p.prodavac_username || 'Nepoznato'} (${p.uloga_prodavac || 'nepoznato'})`
      ]
    })
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prodaje_${new Date().toLocaleDateString('sr-RS')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  // Akcije za prodaju
  const otvoriEdit = (prodaja: any) => {
    setSelectedProdaja(prodaja)
    setNovaCena(prodaja.cena_po_komadu || 0)
    setNovaUlaznaCena(prodaja.artikli?.ulazna_cena ?? '')
    setEditModal(true)
  }

  const sacuvajEdit = async () => {
    if (!selectedProdaja || novaCena <= 0) {
      alert('Unesi validnu cenu!')
      return
    }
    setLoadingAction(true)
    try {
      // Call server-side RPC to safely update prodaje, artikli and kasa in one atomic transaction
      const { error } = await supabase.rpc('koriguj_prodaju', {
        p_id: selectedProdaja.id,
        p_nova_cena: novaCena,
        p_nova_ulazna: novaUlaznaCena === '' ? null : novaUlaznaCena,
        p_username: currentUser?.id || 'admin',
        p_korekcija_razlog: 'Izmena preko admin UI'
      })

      if (error) throw error
      await ucitajProdaje()
      setEditModal(false)
      alert('Cena i ulazna cena uspešno izmenjene!')
    } catch (err: any) {
      alert('Greška: ' + (err.message || err))
      console.error(err)
    } finally {
      setLoadingAction(false)
    }
  }

  const otvoriStorno = (prodaja: any) => {
    setSelectedProdaja(prodaja)
    setStornoRazlog('')
    setStornoModal(true)
  }

  const izvrsiStorno = async () => {
    if (!stornoRazlog.trim()) {
      alert('Unesi razlog storna!')
      return
    }
    setLoadingAction(true)
    try {
      // Call server-side RPC to perform storno atomically (prodaja.status + artikli.kolicina + kasa.stanje_zarada)
      const { error } = await supabase.rpc('storno_prodaje', {
        p_id: selectedProdaja.id,
        p_stornirao_username: currentUser?.id || 'admin',
        p_razlog: stornoRazlog
      })

      if (error) throw error
      await ucitajProdaje()
      setStornoModal(false)
      alert('✅ Prodaja stornirana i artikl vraćen na lager, kasa umanjena!')
    } catch (err: any) {
      alert('❌ Greška: ' + (err.message || err))
      console.error(err)
    } finally {
      setLoadingAction(false)
    }
  }

  const obrisiProdaja = async (prodajaId: string) => {
    if (!confirm('STALNO OBRIŠI ovu prodaju? Nepovratno!')) return

    setLoadingAction(true)
    try {
      const { error } = await supabase
        .from('prodaje')
        .delete()
        .eq('id', prodajaId)

      if (error) throw error
      await ucitajProdaje()
      alert('Prodaja obrisana!')
    } catch (err: any) {
      alert('Greška: ' + (err.message || err))
    } finally {
      setLoadingAction(false)
    }
  }

  const otvoriResetProdaja = () => {
    setShowResetConfirm(true)
    setResetCode('')
  }

  const izvrsiResetProdaja = async () => {
    if (resetCode !== '1234') {
      alert('Pogrešan kod!')
      return
    }
    setLoadingReset(true)
    try {
      const { error } = await supabase
        .from('prodaje')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) throw error
      setProdaje([])
      alert('Sve prodaje obrisane!')
    } catch (err) {
      alert('Greška pri resetu!')
    } finally {
      setLoadingReset(false)
      setShowResetConfirm(false)
    }
  }

  if (loading || !currentUser) {
    return <div className="p-10 text-center text-xl">Učitavanje...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-8 rounded-xl shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-6 flex items-center gap-4 justify-center">
            <CurrencyEuroIcon className="w-12 h-12" />
            Pregled svih prodaja
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 text-center mb-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-indigo-100 text-lg">Broj prodaja</p>
              <p className="text-4xl font-bold">{filtered.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-indigo-100 text-lg">Ukupno naplaćeno</p>
              <p className="text-4xl font-bold">{ukupnaZarada.toFixed(2)} €</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-indigo-100 text-lg">Realna marža</p>
              <p className={`text-4xl font-bold ${ukupnaRealnaMarza >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {ukupnaRealnaMarza.toFixed(2)} €
              </p>
            </div>
            <div className="flex flex-col gap-3 justify-center">
              <button
                onClick={exportCSV}
                className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-bold transition flex items-center justify-center gap-3"
              >
                <ArrowDownTrayIcon className="w-6 h-6" />
                Preuzmi CSV
              </button>
              <a
                href="/admin/obavestenja"
                className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-bold transition flex items-center justify-center gap-3"
              >
                <ExclamationTriangleIcon className="w-6 h-6" />
                Obaveštenja lager
              </a>
            </div>
          </div>
        </div>

        {/* FILTERI */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Filteri</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pretraži po artiklu ili prodavcu..."
                value={pretraga}
                onChange={(e) => setPretraga(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Datum od:</label>
              <input
                type="date"
                value={datumOd}
                onChange={(e) => setDatumOd(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Datum do:</label>
              <input
                type="date"
                value={datumDo}
                onChange={(e) => setDatumDo(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
              />
            </div>
          </div>
          <div className="mt-6 text-right">
            <button
              onClick={otvoriResetProdaja}
              disabled={loadingAction}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Obriši SVE prodaje
            </button>
          </div>
        </div>

        {/* TABELA */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-10">
          <div className="p-6 border-b bg-gray-50">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <CalendarDaysIcon className="w-8 h-8 text-indigo-600" />
              Lista prodaja ({filtered.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 text-left">Datum i vreme</th>
                  <th className="p-4 text-left">Artikal</th>
                  <th className="p-4 text-right">Ulazna cena</th>
                  <th className="p-4 text-right">Prodajna cena</th>
                  <th className="p-4 text-right">Marža/kom</th>
                  <th className="p-4 text-right">Količina</th>
                  <th className="p-4 text-right">Ukupno</th>
                  <th className="p-4 text-left">Prodao</th>
                  <th className="p-4 text-center w-32">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-gray-500">
                      Nema prodaja za izabrane filtere.
                    </td>
                  </tr>
                ) : (
                  paginated.map((p) => {
                    const ulazna = p.artikli?.ulazna_cena || 0
                    const prodajna = p.cena_po_komadu || 0
                    const marzaPoKom = prodajna - ulazna
                    const jeStornirano = p.status === 'stornirana'
                    return (
                      <tr key={p.id} className={`border-t hover:bg-gray-50 transition ${jeStornirano ? 'bg-red-50 opacity-75' : ''}`}>
                        <td className="p-4 text-sm">{new Date(p.datum).toLocaleString('sr-RS')}</td>
                        <td className={`p-4 font-medium ${jeStornirano ? 'line-through text-red-700' : ''}`}>{p.artikli?.naziv || 'Nepoznato'}</td>
                        <td className="p-4 text-right text-gray-600">{ulazna.toFixed(2)} €</td>
                        <td className="p-4 text-right font-bold">{prodajna.toFixed(2)} €</td>
                        <td className="p-4 text-right font-medium">
                          <span className={`font-bold ${marzaPoKom >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {marzaPoKom.toFixed(2)} €
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold">{p.kolicina_prodato || 0}</td>
                        <td className="p-4 text-right font-bold text-green-600">
                          {(p.ukupna_zarada || 0).toFixed(2)} €
                        </td>
                        <td className="p-4">
                          {p.prodavac_username || 'Nepoznato'}{' '}
                          <span className="text-gray-500">({p.uloga_prodavac || 'nepoznato'})</span>
                          {jeStornirano && (
                            <span className="ml-2 bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-bold">
                              STORNO
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => otvoriEdit(p)}
                              disabled={jeStornirano || loadingAction}
                              title="Izmeni cenu i ulaznu cenu"
                              className="p-1 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            {!jeStornirano && (
                              <button
                                onClick={() => otvoriStorno(p)}
                                disabled={loadingAction}
                                title="Storno"
                                className="p-1 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-800 rounded disabled:opacity-50 transition"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => obrisiProdaja(p.id)}
                              disabled={loadingAction}
                              title="Obriši"
                              className="p-1 text-red-600 hover:bg-red-100 hover:text-red-800 rounded disabled:opacity-50 transition"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-6 border-t bg-gray-50 flex justify-center gap-4">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1 || loadingAction}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Prethodna
              </button>
              <span className="px-6 py-3 text-lg font-medium">
                Strana {page} od {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages || loadingAction}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Sledeća
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-xl font-bold text-xl transition shadow-lg"
          >
            ← Nazad na dashboard
          </button>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-indigo-600 mb-6 text-center">
              Izmeni cenu i ulaznu cenu
            </h2>
            <p className="text-gray-600 mb-4">Artikal: <strong>{selectedProdaja?.artikli?.naziv}</strong></p>
            <div className="space-y-4">
              <label className="block text-sm font-medium mb-2">Nova prodajna cena po komadu (€):</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={novaCena}
                onChange={(e) => setNovaCena(Number(e.target.value))}
                className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 text-lg"
                autoFocus
              />
              <label className="block text-sm font-medium mb-2">Nova ulazna cena artikla (€):</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={novaUlaznaCena}
                onChange={(e) => setNovaUlaznaCena(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 text-lg"
              />
              <div className="flex gap-4 pt-6">
                <button
                  onClick={sacuvajEdit}
                  disabled={loadingAction || novaCena <= 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-lg font-bold text-lg transition disabled:opacity-70"
                >
                  {loadingAction ? 'Sačuvavam...' : 'Sačuvaj izmenu'}
                </button>
                <button
                  onClick={() => setEditModal(false)}
                  disabled={loadingAction}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-lg font-bold text-lg transition disabled:opacity-70"
                >
                  Otkaži
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STORNO MODAL */}
      {stornoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-yellow-600 mb-6 text-center">
              Storno prodaje
            </h2>
            <p className="text-gray-600 mb-6">Artikal: <strong>{selectedProdaja?.artikli?.naziv}</strong></p>
            <label className="block text-sm font-medium mb-2">Razlog storna (obavezan):</label>
            <textarea
              value={stornoRazlog}
              onChange={(e) => setStornoRazlog(e.target.value)}
              placeholder="Unesi razlog storna (npr. 'Pogrešna cena', 'Artikal vratio kupac'...)"
              className="w-full p-4 border-2 border-gray-300 rounded-lg h-32 focus:outline-none focus:ring-4 focus:ring-yellow-300 mb-6 resize-vertical"
              autoFocus
            />
            <div className="flex gap-4">
              <button
                onClick={izvrsiStorno}
                disabled={loadingAction || !stornoRazlog.trim()}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-4 rounded-lg font-bold text-lg transition disabled:opacity-70"
              >
                {loadingAction ? 'Storniram...' : 'Potvrdi STORNO'}
              </button>
              <button
                onClick={() => setStornoModal(false)}
                disabled={loadingAction}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-lg font-bold text-lg transition disabled:opacity-70"
              >
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRM MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-6 text-center">
              UPOZORENJE: Reset SVIH prodaja!
            </h2>
            <p className="text-lg mb-6 text-center">
              Ova akcija je <strong>nepovratna</strong>. Unesi kod: <strong>1234</strong>
            </p>
            <input
              type="text"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              placeholder="Unesi 1234"
              className="w-full p-4 border-2 border-red-300 rounded-lg text-xl text-center mb-6 focus:outline-none focus:ring-4 focus:ring-red-300"
              autoFocus
            />
            <div className="flex gap-4">
              <button
                onClick={izvrsiResetProdaja}
                disabled={loadingReset || resetCode !== '1234'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold transition disabled:opacity-70"
              >
                {loadingReset ? 'Brisanje u toku...' : 'OBRIŠI SVE'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-lg font-bold transition"
              >
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}