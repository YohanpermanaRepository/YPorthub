import React, { useState, useEffect, useCallback } from 'react';
import type { ContactData } from '../types';
import { API_BASE_URL } from '../config';

const ContactManager: React.FC = () => {
    const [contact, setContact] = useState<ContactData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const CONTACT_PATH = '/contacts';

    const fetchContact = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const url = `${API_BASE_URL}${CONTACT_PATH}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch contact data`);
            }

            const data = await response.json();
            setContact(data);

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContact();
    }, [fetchContact]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        if (!contact) return;

        const { name, value } = e.target;

        setContact({
            ...contact,
            [name]: value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!contact) return;

        setError(null);
        setSuccess(null);

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}${CONTACT_PATH}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(contact)
            });

            if (!response.ok) {
                throw new Error('Failed to update contact info');
            }

            setSuccess("Contact info updated successfully!");

        } catch (err) {
            setError((err as Error).message);
        }
    };

    if (isLoading) return <p className="text-white">Loading contact info...</p>;

    return (
        <div className="bg-navy-900 text-white p-8 rounded-lg shadow">

            <h2 className="text-2xl font-bold mb-6">
                Manage Contact Info
            </h2>

            {error && (
                <p className="text-red-400 bg-red-900 p-3 rounded-md my-4">
                    {error}
                </p>
            )}

            {success && (
                <p className="text-green-400 bg-green-900 p-3 rounded-md my-4">
                    {success}
                </p>
            )}

            {contact && (
                <form onSubmit={handleSubmit} className="space-y-4">

                    <input
                        name="email"
                        value={contact.email}
                        onChange={handleInputChange}
                        placeholder="Email"
                        required
                        className="w-full p-2 border border-gray-300 bg-white text-black rounded"
                    />

                    <input
                        name="linkedin"
                        value={contact.linkedin}
                        onChange={handleInputChange}
                        placeholder="LinkedIn URL"
                        required
                        className="w-full p-2 border border-gray-300 bg-white text-black rounded"
                    />

                    <input
                        name="instagram"
                        value={contact.instagram}
                        onChange={handleInputChange}
                        placeholder="Instagram URL"
                        required
                        className="w-full p-2 border border-gray-300 bg-white text-black rounded"
                    />

                    <input
                        name="youtube"
                        value={contact.youtube}
                        onChange={handleInputChange}
                        placeholder="YouTube URL"
                        required
                        className="w-full p-2 border border-gray-300 bg-white text-black rounded"
                    />

                    <textarea
                        name="description"
                        value={contact.description}
                        onChange={handleInputChange}
                        placeholder="Contact Description"
                        required
                        rows={3}
                        className="w-full p-2 border border-gray-300 bg-white text-black rounded"
                    />

                    <div className="text-right">

                        <button
                            type="submit"
                            className="bg-navy-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-navy-600"
                        >
                            Save Changes
                        </button>

                    </div>

                </form>
            )}

        </div>
    );
};

export default ContactManager;