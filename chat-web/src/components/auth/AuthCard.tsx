import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="auth-bg min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg mb-4">
            <span className="text-3xl font-black text-uol-blue">U</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="text-white/80 mt-2">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">{children}</div>

        {/* Rodapé */}
        <div className="text-center mt-6 text-white/90">{footer}</div>
      </div>
    </div>
  )
}