'use client'

import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function ObavestenjaLager() {
  const [niskiLager, setNiskiLager] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function ucitajNiskiLager() {
      const { data } = await supabase
        .from('artikli')
        .select('*')
        .lt('kolicina', 2)
        .order('kolicina', { ascending: true })
      setNiskiLager(data || [])
      setLoading(false)
      if (data && data.length > 0) {
        // Opciono: pošalji email obaveštenje (koristi Supabase functions ili external service)
        console.log('Obaveštenje: Niski lager artikala!')
      }
    }
    ucitajNiskiLager()

    // Realtime za promene u lageru
    const channel = supabase
      .channel('artikli-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artikli' }, ucitajNiskiLager)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) return <div className="p-10 text-center">Učitavanje obaveštenja...</div>

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
        Obaveštenja o niskom lageru (stanje < 2)
      </h2>
      {niskiLager.length === 0 ? (
        <p className="text-center text-gray-600 text-lg">Svi artikli su na zadovoljavajućem stanju. 👍</p>
      ) : (
        <div className="grid gap-4">
          {niskiLager.map(art => (
            <div key={art.id} className="bg-red-50 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-semibold text-lg">{art.naziv}</p>
                <p className="text-red-600 font-bold">Količina: {art.kolicina}</p>
                <p className="text-sm text-gray-500">Unos: {new Date(art.created_at).toLocaleDateString('sr-RS')}</p>
              </div>
              <button onClick={() => izmeniArtikal(art)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
                Dopuni lager
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}