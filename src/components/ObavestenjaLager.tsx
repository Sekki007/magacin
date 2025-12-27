'use client'

import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

export default function ObavestenjaLager() {
  const router = useRouter()
  const [niskiLager, setNiskiLager] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Asinhrona funkcija unutar useEffect-a
    const ucitajNiskiLager = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('artikli')
          .select('*')
          .lt('kolicina', 2)
          .order('kolicina', { ascending: true })

        if (error) {
          console.error('Greška pri učitavanju niskog lagera:', error)
          setNiskiLager([])
        } else {
          setNiskiLager(data || [])
          if (data && data.length > 0) {
            console.log('Obaveštenje: Niski lager artikala!', data)
            // Opcionalno: ovde možeš dodati toast, email, itd.
          }
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
          event: '*',
          schema: 'public',
          table: 'artikli',
        },
        (payload) => {
          console.log('Promena u artiklima:', payload)
          ucitajNiskiLager() // osveži listu kad god dođe promena
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Pretplaćen na realtime promene artikala')
        }
      })

    // Cleanup pri unmount-u
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Funkcija za preusmeravanje na izmenu artikla (npr. na dashboard ili posebnu stranicu)
  const idiNaIzmenu = (artikalId: string) => {
    // Ako imaš dashboard gde možeš menjati artikle, preusmeri tamo
    router.push(`/?edit=${artikalId}`)
    // Ili ako imaš posebnu admin stranicu za artikle:
    // router.push(`/admin/artikli?edit=${artikalId}`)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="p-10 text-center">Učitavanje obaveštenja...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
        Obaveštenja o niskom lageru (količina {"<"} 2)
      </h2>

      {niskiLager.length === 0 ? (
        <p className="text-center text-gray-600 text-lg py-8">
          Svi artikli su na zadovoljavajućem stanju. 👍
        </p>
      ) : (
        <div className="grid gap-4">
          {niskiLager.map((art) => (
            <div
              key={art.id}
              className="bg-red-50 border border-red-200 p-6 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
              <div>
                <p className="font-semibold text-lg">{art.naziv}</p>
                <p className="text-red-700 font-bold text-xl">Količina: {art.kolicina}</p>
                <p className="text-sm text-gray-500">
                  Unos: {new Date(art.created_at).toLocaleDateString('sr-RS')}
                </p>
              </div>
              <button
                onClick={() => idiNaIzmenu(art.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition shadow-md"
              >
                Dopuni lager
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}