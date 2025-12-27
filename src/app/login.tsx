'use client'

import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/') // Preusmeri na dashboard
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else alert('Proveri email za potvrdu!')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Prijava</h2>
        <form onSubmit={login}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mb-4 w-full p-3 border rounded" />
          <input type="password" placeholder="Lozinka" value={password} onChange={(e) => setPassword(e.target.value)} required className="mb-4 w-full p-3 border rounded" />
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700">Prijavi se</button>
        </form>
        <button onClick={signup} className="w-full mt-4 bg-gray-600 text-white py-3 rounded hover:bg-gray-700">Registruj se</button>
        {error && <p className="mt-4 text-red-600 text-center">{error}</p>}
      </div>
    </div>
  )
}