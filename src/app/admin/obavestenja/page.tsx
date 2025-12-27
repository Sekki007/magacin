'use client'

import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function ObavestenjaLager() {
  const [niskiLager, setNiskiLager] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Asinhrona funkcija za učitavanje niskog lagera
    const ucitajNiskiLager = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('artikli')
          .select('*')
          .lt('kolicina', 2)
          .order('kolicina', { ascending: true })

        if (error) {
          console.error('Greška pri učitavanju artikala:', error)
          setNiskiLager([])
        } else {
          setNiskiLager(data || [])
        }
      } catch (err) {
        console.error('Neočekivana greška:', err)
        setNiskiLager([])
      } finally {
        setLoading(false)
      }
    }

    // Prvo učitavanje
    ucitajNiskiLager()

    // Realtime pretplata na promene u tabeli artikli
    const channel = supabase
      .channel('artikli-low-stock')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'artikli',
        },
        (payload) => {
          console.log('Promena u artiklima:', payload)
          ucitajNiskiLager() // osveži listu kad god dođe do promene
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Uspešno pretplaćen na promene artikala')
        }
      })

    // Cleanup: ukloni kanal kad se komponenta unmount-uje
    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // [] jer se učitava samo jednom (i osvežava preko realtime-a)

  if (loading) {
    return <div className="p-10 text-center">Učitavanje obaveštenja...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Obaveštenja o niskom lageru</h1>

        {niskiLager.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <p className="text-lg font-medium text-green-800">
              Svi artikli su na zadovoljavajućem stanju.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {niskiLager.map((art) => (
              <div
                key={art.id}
                className="bg-red-50 border border-red-200 rounded-lg p-6 flex justify-between items-center"
              >
                <div className="flex items-center gap-4">
                  <ExclamationTriangleIcon className="h-10 w-10 text-red-600" />
                  <div>
                    <h3 className="text-lg font-semibold">{art.naziv}</h3>
                    <p className="text-red-700 font-medium">
                      Trenutna količina: {art.kolicina}
                    </p>
                    <p className="text-sm text-gray-600">
                      Datum unosa: {new Date(art.created_at).toLocaleDateString('sr-RS')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => (window.location.href = '/admin/artikli')} // bolje ka stranici za artikle
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-medium transition"
                >
                  Dopuni lager
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}