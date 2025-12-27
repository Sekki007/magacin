'use client'

import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  CurrencyEuroIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

export default function PregledProdaja() {
  const router = useRouter()
  const [prodaje, setProdaje] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [pretraga, setPretraga] = useState('')
  const [datumOd, setDatumOd] = useState('')
  const [datumDo, setDatumDo] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 20

  // Reset prodaja sa sigurnosnim kodom
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [loadingReset, setLoadingReset] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data } = await supabase.from('profiles').select('uloga').eq('id', session.user.id).single()
      if (data.uloga !== 'admin') {
        router.push('/')
        return
      }
      setCurrentUser(data)

      const { data: p } = await supabase
        .from('prodaje')
        .select('*, artikli(naziv)')
        .order('datum', { ascending: false })

      setProdaje(p || [])
      setFiltered(p || [])
    }
    check()
  }, [router])

  // Filtriranje
  useEffect(() => {
    let temp = prodaje

    if (pretraga) {
      temp = temp.filter(p =>
        p.artikli?.naziv.toLowerCase().includes(pretraga.toLowerCase()) ||
        p.prodavac_username.toLowerCase().includes(pretraga.toLowerCase())
      )
    }

    if (datumOd) {
      temp = temp.filter(p => new Date(p.datum) >= new Date(datumOd))
    }
    if (datumDo) {
      temp = temp.filter(p => new Date(p.datum) <= new Date(datumDo + 'T23:59:59'))
    }

    setFiltered(temp)
    setPage(1)
  }, [pretraga, datumOd, datumDo, prodaje])

  if (!currentUser) return <div className="p-10 text-center text-xl">Učitavanje...</div>

  const ukupnaZarada = filtered.reduce((sum, p) => sum + p.ukupna_zarada, 0)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filtered.length / perPage)

  // Export u CSV
  function exportCSV() {
    const headers = ['Datum', 'Artikal', 'Količina', 'Cena po kom', 'Zarada', 'Prodao']
    const rows = filtered.map(p => [
      new Date(p.datum).toLocaleString('sr-RS'),
      p.artikli?.naziv || 'Nepoznato',
      p.kolicina_prodato,
      p.cena_po_komadu.toFixed(2),
      p.ukupna_zarada.toFixed(2),
      `${p.prodavac_username} (${p.uloga_prodavac})`
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prodaje_${new Date().toLocaleDateString('sr-RS')}.csv`
    a.click()
  }

  // Reset svih prodaja
  function otvoriResetProdaja() {
    setShowResetConfirm(true)
    setResetCode('')
  }

  async function izvrsiResetProdaja() {
    if (resetCode !== '1234') { // ← PROMIJENI U SVOJ SIGURNOSNI KOD
      alert('Pogrešan kod! Reset otkazan.')
      return
    }

    setLoadingReset(true)
    try {
      await supabase.from('prodaje').delete().neq('id', '00000000-0000-0000-0000-000000000000') // briše sve
      setProdaje([])
      setFiltered([])
      alert('Sve prodaje su uspešno obrisane!')
    } catch (err) {
      alert('Greška pri brisanju prodaja!')
      console.error(err)
    } finally {
      setLoadingReset(false)
      setShowResetConfirm(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-8 rounded-xl shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-6 flex items-center gap-4 justify-center">
            <CurrencyEuroIcon className="w-12 h-12" />
            Pregled svih prodaja
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center mb-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-indigo-100 text-lg">Broj prodaja</p>
              <p className="text-4xl font-bold">{filtered.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-indigo-100 text-lg">Ukupna zarada</p>
              <p className="text-5xl font-bold">{ukupnaZarada.toFixed(2)} €</p>
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

        {/* Filteri */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Filteri</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pretraži po artiklu ili prodavcu..."
                value={pretraga}
                onChange={e => setPretraga(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Datum od:</label>
              <input
                type="date"
                value={datumOd}
                onChange={e => setDatumOd(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Datum do:</label>
              <input
                type="date"
                value={datumDo}
                onChange={e => setDatumDo(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Dugme za reset prodaja */}
          <div className="mt-6 text-right">
            <button
              onClick={otvoriResetProdaja}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Obriši sve prodaje
            </button>
          </div>
        </div>

        {/* Tabela prodaja */}
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
                  <th className="p-4 text-right">Količina</th>
                  <th className="p-4 text-right">Cena po kom</th>
                  <th className="p-4 text-right">Zarada</th>
                  <th className="p-4 text-left">Prodao</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-gray-500">
                      Nema prodaja za izabrane filtere.
                    </td>
                  </tr>
                ) : (
                  paginated.map(p => (
                    <tr key={p.id} className="border-t hover:bg-gray-50 transition">
                      <td className="p-4 text-sm">{new Date(p.datum).toLocaleString('sr-RS')}</td>
                      <td className="p-4 font-medium">{p.artikli?.naziv || 'Nepoznato'}</td>
                      <td className="p-4 text-right font-bold">{p.kolicina_prodato}</td>
                      <td className="p-4 text-right">{p.cena_po_komadu.toFixed(2)} €</td>
                      <td className="p-4 text-right font-bold text-green-600">{p.ukupna_zarada.toFixed(2)} €</td>
                      <td className="p-4">{p.prodavac_username} <span className="text-gray-500">({p.uloga_prodavac})</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginacija */}
          {totalPages > 1 && (
            <div className="p-6 border-t bg-gray-50 flex justify-center gap-4">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Prethodna
              </button>
              <span className="px-6 py-3 text-lg font-medium">
                Strana {page} od {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Sledeća
              </button>
            </div>
          )}
        </div>

        {/* Nazad dugme */}
        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-xl font-bold text-xl transition shadow-lg"
          >
            ← Nazad na dashboard
          </button>
        </div>

        {/* Modal za reset prodaja */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-red-600 mb-6 text-center">
                Upozorenje: Brisanje svih prodaja!
              </h2>
              <p className="text-lg mb-6 text-center">
                Ova akcija je <strong>nepovratna</strong>. Unesi sigurnosni kod za potvrdu:
              </p>
              <input
                type="text"
                value={resetCode}
                onChange={e => setResetCode(e.target.value)}
                placeholder="Unesi kod (1234)"
                className="w-full p-4 border-2 border-red-300 rounded-lg text-xl text-center mb-6 focus:outline-none focus:ring-4 focus:ring-red-300"
                autoFocus
              />
              <div className="flex gap-4">
                <button
                  onClick={izvrsiResetProdaja}
                  disabled={loadingReset}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold transition disabled:opacity-70"
                >
                  {loadingReset ? 'Brisanje u toku...' : 'Obriši sve prodaje'}
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
    </div>
  )
}