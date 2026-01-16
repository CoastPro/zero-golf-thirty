import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function AdminLogin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(pin)) {
      navigate('/admin');
    } else {
      setError('Invalid PIN');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src="/southern-fairways-logo.png" 
              alt="Southern Fairways Golf Tour" 
              className="w-full max-w-sm"
            />
          </div>
          
          {/* Live Scoring Button */}
          <button
            onClick={() => navigate('/public')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xl py-4 rounded-xl transition-colors shadow-lg mb-8"
          >
            Live Scoring
          </button>

          {/* Admin Access Section */}
          <div className="border-t pt-6">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
              Admin Access
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl tracking-widest"
                  placeholder="••••••"
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg"
              >
                Enter Admin
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}