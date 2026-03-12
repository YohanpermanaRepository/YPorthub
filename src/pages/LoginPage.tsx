import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Invalid username or password');
      }

      onLoginSuccess(data.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-navy-500 opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 opacity-10 rounded-full blur-3xl"></div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-navy-500 to-indigo-600 rounded-xl shadow-lg mb-6">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">YPorthub</h1>
          <p className="text-sm text-gray-400">Yohan Permana Portfolio Hub</p>
          <p className="text-xs text-gray-500 mt-3">Professional Portfolio Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white bg-opacity-95 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6">
          {/* Card Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-sm text-gray-600">Sign in to manage your portfolio</p>
          </div>

          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent transition"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent transition"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Info Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowAboutModal(true)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About
          </button>
          <button
            type="button"
            onClick={() => setShowDemoModal(true)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Demo
          </button>
        </div>
      </div>

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-navy-500 to-indigo-600 px-6 py-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white bg-opacity-20 rounded-full p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Tentang YPorthub</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAboutModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-8">
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-3">🚀 Apa itu YPorthub?</h4>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">
                  YPorthub adalah sistem manajemen portfolio profesional yang dirancang khusus untuk menampilkan dan mengelola portofolio digital Anda dengan cara yang elegan dan efisien.
                </p>
              </div>

              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-3">✨ Fitur Utama</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-navy-500 font-bold mt-1">✓</span>
                    <span>Kelola profil, pengalaman, dan pendidikan Anda</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-navy-500 font-bold mt-1">✓</span>
                    <span>Tampilkan proyek dan teknologi yang Anda kuasai</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-navy-500 font-bold mt-1">✓</span>
                    <span>Kelola sertifikasi dan informasi kontak</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-navy-500 font-bold mt-1">✓</span>
                    <span>Antarmuka intuitif dan mudah digunakan</span>
                  </li>
                </ul>
              </div>

              <div className="bg-navy-50 border border-navy-200 rounded-lg px-4 py-3">
                <p className="text-navy-800 text-sm">
                  <span className="font-semibold">💼 Dibuat oleh:</span> Yohan Permana
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="w-full bg-navy-600 hover:bg-navy-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white bg-opacity-20 rounded-full p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Demo Account</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-8">
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                Selamat datang! Gunakan akun demo di bawah untuk mengeksplorasi fitur-fitur lengkap YPorthub. Akses read-only untuk preview dan testing sistem:
              </p>

              {/* Credentials Container */}
              <div className="space-y-4 bg-gray-50 rounded-lg p-4 mb-6">
                {/* Username */}
                <div className="bg-white rounded-lg p-4 border-l-4 border-emerald-500">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Username
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-mono font-semibold text-gray-900">
                      demo
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('demo');
                      }}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                      title="Copy to clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div className="bg-white rounded-lg p-4 border-l-4 border-teal-500">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-mono font-semibold text-gray-900">
                      demo123
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('demo123');
                      }}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                      title="Copy to clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* Features Note */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6">
                <p className="text-emerald-800 text-sm">
                  <span className="font-semibold">🔒 Akses Read-Only:</span> Lihat dan eksplorasi semua fitur CMS tanpa bisa mengedit atau menghapus data.
                </p>
              </div>

              {/* Tips */}
              <div className="bg-navy-50 border border-navy-200 rounded-lg px-4 py-3">
                <p className="text-navy-800 text-sm">
                  <span className="font-semibold">💡 Tips:</span> Tekan tombol <span className="bg-navy-100 px-1.5 py-0.5 rounded font-mono text-xs">Copy</span> untuk menyalin credentials dengan cepat!
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Mari Mulai Explore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
