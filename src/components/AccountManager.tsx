import React, { useState } from 'react';
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
        <div className="bg-white p-8 rounded-lg shadow max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Account Settings</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Change Credentials</h3>
                    <p className="mt-1 text-sm text-gray-600">
                        Update your username or password. You must provide your current password to make any changes.
                    </p>
                </div>
                
                <div className="space-y-4">
                     <div>
                        <label htmlFor="newUsername" className="block text-sm font-medium text-gray-700">New Username (optional)</label>
                        <input
                            id="newUsername"
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent"
                        />
                    </div>
                     <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password (optional)</label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent"
                        />
                    </div>
                     <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent"
                        />
                    </div>
                </div>

                <hr/>
                
                <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                       Current Password (required to save changes)
                    </label>
                    <input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent"
                    />
                </div>
                
                {error && <p className="text-red-500 bg-red-100 p-3 rounded-md text-sm">{error}</p>}
                {success && <p className="text-green-600 bg-green-100 p-3 rounded-md text-sm">{success}</p>}
                
                <div className="text-right">
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="bg-accent text-white font-bold py-2 px-6 rounded-lg hover:bg-opacity-80 disabled:bg-gray-400"
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AccountManager;
