import React from 'react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard if user is authenticated
    const token = localStorage.getItem('auth-token')
    if (token) {
      router.push('/dashboard')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Lunara Afiliados
          </h1>
          <p className="text-gray-600 mb-8">
            Sistema de gestão de afiliados para terapeutas
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fazer Login
            </button>
            
            <button
              onClick={() => router.push('/auth/register')}
              className="w-full border border-blue-600 text-blue-600 py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Criar Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}