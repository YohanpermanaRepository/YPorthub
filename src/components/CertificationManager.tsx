import React, { useState, useEffect, useCallback } from 'react';
import type { Certification } from '../types';
import { API_BASE_URL } from '../config';

// Define initial form data OUTSIDE the component to prevent re-creation on every render.
const initialFormData: Omit<Certification, 'id'> = { category: '', name: '', issuer: '', year: new Date().getFullYear(), link: '' };

const CertificationManager: React.FC = () => {
    const [certifications, setCertifications] = useState<Certification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<Certification | null>(null);
    
    const [formData, setFormData] = useState<Omit<Certification, 'id'>>(initialFormData);

    const fetchCerts = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/certifications`);
            if (!response.ok) throw new Error('Failed to fetch certifications');
            setCertifications(await response.json());
        } catch (err) { setError((err as Error).message); } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchCerts(); }, [fetchCerts]);

    // This effect now correctly populates the form for editing or resets it for a new entry.
    useEffect(() => {
        if (editingCert) setFormData(editingCert);
        else setFormData(initialFormData);
    }, [editingCert]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || new Date().getFullYear() : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        const method = editingCert ? 'PUT' : 'POST';
        const url = editingCert ? `${API_BASE_URL}/certifications/${editingCert.id}` : `${API_BASE_URL}/certifications`;

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error(`Failed to ${editingCert ? 'update' : 'create'} certification`);
            
            await fetchCerts();
            closeForm();
        } catch (err) { setError((err as Error).message); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure?")) return;
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/certifications/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete certification');
            setCertifications(prev => prev.filter(c => c.id !== id));
        } catch (err) { setError((err as Error).message); }
    };
    
    const openForm = (cert: Certification | null = null) => { setEditingCert(cert); setIsFormOpen(true); };
    const closeForm = () => { setEditingCert(null); setIsFormOpen(false); setError(null); };

    return (
        <div className="bg-white p-8 rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Manage Certifications</h2>
                <button onClick={() => openForm()} className="bg-accent text-white font-bold py-2 px-4 rounded-lg">Add New</button>
            </div>

            {isLoading && <p>Loading...</p>}
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-md my-4">{error}</p>}
            
            {isFormOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4">{editingCert ? 'Edit' : 'Add'} Certification</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Certification Name" required className="w-full p-2 border rounded"/>
                            <input name="issuer" value={formData.issuer} onChange={handleInputChange} placeholder="Issuer" required className="w-full p-2 border rounded"/>
                            <input name="category" value={formData.category} onChange={handleInputChange} placeholder="Category" required className="w-full p-2 border rounded"/>
                            <input name="year" type="number" value={formData.year} onChange={handleInputChange} placeholder="Year" required className="w-full p-2 border rounded"/>
                            <input name="link" value={formData.link} onChange={handleInputChange} placeholder="Certificate Link" required className="w-full p-2 border rounded"/>
                            <div className="flex justify-end gap-4">
                                <button type="button" onClick={closeForm} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancel</button>
                                <button type="submit" className="bg-accent text-white font-bold py-2 px-4 rounded-lg">{editingCert ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {certifications.map(cert => (
                    <div key={cert.id} className="p-4 border rounded-lg flex justify-between items-center">
                        <p className="font-bold text-lg">{cert.name}</p>
                        <div className="space-x-2 flex-shrink-0">
                            <button onClick={() => openForm(cert)} className="text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => handleDelete(cert.id)} className="text-red-600 hover:underline">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CertificationManager;
