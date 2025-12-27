'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Koristimo @localhost da izbjegnemo Supabase validaciju emaila
    const email = `${username.toLowerCase().trim()}@example.com`

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // ----------------- DETALJAN ERROR LOG -----------------
    if (error) {
      console.error('SUPABASE AUTH GREŠKA:')
      console.error('Message:', error.message)
      console.error('Status:', error.status)
      console.error('Full error object:', error)

      // Prilagođene poruke korisniku
      if (error.message.toLowerCase().includes('confirmed')) {
        setError('Nalog nije potvrđen. Kontaktiraj admina ili provjeri Supabase postavke.')
      } else if (error.message.includes('Invalid login credentials')) {
        setError('Pogrešan username ili lozinka.')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Email nije potvrđen. Isključi "Confirm email" u Supabase settings.')
      } else {
        setError('Greška pri logovanju: ' + error.message)
      }
    } else {
      // Login uspješan
      console.log('Uspješan login!', data.user)

      // VIŠE NE RADIMO UPSERT – profil se kreira samo prilikom dodavanja korisnika
      // (u UserManagement ili ručno u dashboardu), tako da uloga ostaje ista!

      router.push('/')  // ili '/dashboard' ako ti je glavna stranica tamo
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-xl shadow-2xl w-96">
        <h2 className="text-3xl font-bold mb-8 text-center">Interni Inventory Sistem</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full p-4 border rounded-lg"
            autoFocus
          />
          <input
            type="password"
            placeholder="Lozinka"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-4 border rounded-lg"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-70"
          >
            {loading ? 'Ulazak...' : 'Uloguj se'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">Greška:</p>
            <p>{error}</p>
            <p className="text-sm mt-2">Otvorite konzolu (F12 → Console) za detalje.</p>
          </div>
        )}
      </div>
    </div>
  )
}