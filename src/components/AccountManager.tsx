import React, { useState } from 'react';
import {
    Lock,
    User,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X
} from 'lucide-react';
import { API_BASE_URL } from '../config';

const AccountManager: React.FC = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword && newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }

        if (!newUsername && !newPassword) {
            setError("Please provide a new username or a new password to update.");
            return;
        }
        
        setIsLoading(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication error. Please log in again.");
            setIsLoading(false);
            return;
        }

        const body: {
            currentPassword: string;
            newUsername?: string;
            newPassword?: string;
        } = { currentPassword };
        
        if (newUsername) body.newUsername = newUsername;
        if (newPassword) body.newPassword = newPassword;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/update-credentials`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update credentials.');
            }
            
            setSuccess(data.message);
            // Clear fields on success
            setCurrentPassword('');
            setNewUsername('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4">
            {/* Header Section */}
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
                    <Lock className="text-navy-400" size={24} />
                    Account Settings
                </h2>
                <p className="text-gray-400 text-sm">Update your username or password</p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-3 bg-red-500/10 border border-red-500/50 rounded-lg p-2 flex items-center gap-2 text-red-200">
                    <AlertCircle size={16} />
                    <p className="text-sm flex-1">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200"><X size={16} /></button>
                </div>
            )}

            {/* Success Message */}
            {success && (
                <div className="mb-3 bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-2 flex items-center gap-2 text-emerald-200">
                    <CheckCircle2 size={16} />
                    <p className="text-sm flex-1">{success}</p>
                    <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-200"><X size={16} /></button>
                </div>
            )}
            
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-2xl max-w-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* New Credentials Section */}
                    <div>
                        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                            <User className="text-navy-400" size={18} />
                            Change Credentials
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="newUsername" className="block text-sm font-semibold text-gray-300 mb-2">
                                    New Username (optional)
                                </label>
                                <input
                                    id="newUsername"
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter new username"
                                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-300 mb-2">
                                    New Password (optional)
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-300 mb-2">
                                    Confirm New Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-700"/>

                    {/* Current Password Section */}
                    <div>
                        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                            <Lock className="text-navy-400" size={18} />
                            Verify Identity
                        </h3>
                        
                        <label htmlFor="currentPassword" className="block text-sm font-semibold text-gray-300 mb-2">
                            Current Password (required to save changes)
                        </label>
                        <input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            required
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"
                        />
                        <p className="mt-2 text-xs text-gray-400">
                            We need your current password to confirm any changes to your account.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-3 border-t border-gray-700">
                        <button 
                            type="button"
                            onClick={() => {
                                setCurrentPassword('');
                                setNewUsername('');
                                setNewPassword('');
                                setConfirmPassword('');
                                setError(null);
                                setSuccess(null);
                            }}
                            className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-sm"
                        >
                            Clear
                        </button>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="flex-[2] py-2 px-4 bg-navy-600 hover:bg-navy-500 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AccountManager;
