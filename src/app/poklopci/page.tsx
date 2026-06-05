'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PoklopciDashboard from '@/components/poklopci/PoklopciDashboard'

export default function PoklopciPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setReady(true)
    }
    check()
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900 text-gray-500">
        Učitavanje...
      </div>
    )
  }

  return <PoklopciDashboard />
}
