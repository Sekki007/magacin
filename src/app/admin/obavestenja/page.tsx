'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ObavestenjaLager from '@/components/ObavestenjaLager'
import AdminNav from '@/components/AdminNav'

export default function ObavestenjaPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('uloga, active')
        .eq('id', session.user.id)
        .single()
      if (!profile || profile.uloga !== 'admin' || profile.active === false) {
        router.push('/')
        return
      }
      setReady(true)
    }
    init()
  }, [router])

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600 dark:text-gray-300">Učitavanje...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <AdminNav active="obavestenja" />
        <ObavestenjaLager />
      </div>
    </div>
  )
}
