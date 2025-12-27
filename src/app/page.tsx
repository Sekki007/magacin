'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import InventoryDashboard from '@/components/InventoryDashboard'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      }
    }
    checkSession()

    // Opcionalno: osluškuj promene sesije
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        router.push('/login')
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  return <InventoryDashboard />
}