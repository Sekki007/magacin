'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import InventoryDashboard from '@/components/InventoryDashboard'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setReady(true)
    }
    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.push('/login')
    })

    return () => listener.subscription.unsubscribe()
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-lg">
        Učitavanje...
      </div>
    )
  }

  return <InventoryDashboard initialEditId={editId} />
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-lg">
        Učitavanje...
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
