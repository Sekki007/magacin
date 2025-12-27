'use client'

import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPanel() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [uloga, setUloga] = useState('kolega')
  const [loading, setLoading] = useState(false)
  const [poruka, setPoruka] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  const router = useRouter()

  // Proveri da li je ulogovan i da li je admin
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('uloga')
        .eq('id', session.user.id)
        .single()

      if (data?.uloga !== 'admin') {
        alert('Samo admin može da pristupi ovoj stranici!')
        router.push('/')
        return
      }

      setCurrentUser(data)
    }
    checkUser()
  }, [router])

  // Dodaj novog korisnika
  async function dodajKorisnika(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setPoruka('')

    if (!username || !password) {
      setPoruka('Unesi username i lozinku!')
      setLoading(false)
      return
    }

    const fakeEmail = `${username.toLowerCase().trim()}@interni.local`

    // 1. Kreiraj auth korisnika preko Supabase admin API (koristimo signUp jer je najlakše)
    const { data, error } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
      options: {
        data: { username: username.toLowerCase().trim() } // opcionalno
      }
    })

    if (error) {
      setPoruka('Greška: ' + error.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setPoruka('Greška pri kreiranju korisnika.')
      setLoading(false)
      return
    }

    // 2. Ažuriraj profil sa pravim username-om i ulogom
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        username: username.toLowerCase().trim(),
        uloga: uloga
      }, { onConflict: 'id' })

    if (profileError) {
      setPoruka('Greška pri ažuriranju profila: ' + profileError.message)
    } else {
      setPoruka(`Korisnik "${username}" uspešno dodat sa ulogom "${uloga}"! ✅`)
      setUsername('')
      setPassword('')
      setUloga('kolega')
    }

    setLoading(false)
  }

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center">Provera pristupa...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-10 text-gray-800">
          Admin Panel – Dodavanje korisnika
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={dodajKorisnika} className="space-y-6">
            <div>
              <label className="block text-lg font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full p-4 border rounded-lg text-lg"
                placeholder="npr. pera"
              />
            </div>

            <div>
              <label className="block text-lg font-medium mb-2">Lozinka</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-4 border rounded-lg text-lg"
                placeholder="jaka lozinka"
              />
            </div>

            <div>
              <label className="block text-lg font-medium mb-2">Uloga</label>
              <select
                value={uloga}
                onChange={(e) => setUloga(e.target.value)}
                className="w-full p-4 border rounded-lg text-lg"
              >
                <option value="kolega">Kolega</option>
                <option value="serviser">Serviser</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Dodavanje...' : 'Dodaj korisnika'}
            </button>
          </form>

          {poruka && (
            <div className={`mt-8 p-4 rounded-lg text-center text-lg font-medium ${poruka.includes('uspešno') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {poruka}
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700"
          >
            ← Nazad na dashboard
          </button>
        </div>
      </div>
    </div>
  )
}