import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

interface Technology {
  id: number;
  name: string;
  icon: string | null;
}

const TechnologyManager: React.FC = () => {
    const [technologies, setTechnologies] = useState<Technology[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTechnology, setEditingTechnology] = useState<Technology | null>(null);
    
    const initialFormData: Omit<Technology, 'id'> = { name: '', icon: '' };
    const [formData, setFormData] = useState<Omit<Technology, 'id'>>(initialFormData);

    const fetchTechnologies = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/technologies`);
            if (!response.ok) throw new Error('Failed to fetch technologies');
            const data = await response.json();
            setTechnologies(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTechnologies();
    }, [fetchTechnologies]);

    useEffect(() => {
        if (editingTechnology) {
            setFormData({
                name: editingTechnology.name,
                icon: editingTechnology.icon || '',
            });
        } else {
            setFormData(initialFormData);
        }
    }, [editingTechnology]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error. Please log in again.");

        const method = editingTechnology ? 'PUT' : 'POST';
        const url = editingTechnology 
            ? `${API_BASE_URL}/technologies/${editingTechnology.id}` 
            : `${API_BASE_URL}/technologies`;

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || `Failed to ${editingTechnology ? 'update' : 'create'} technology`);
            }
            
            await fetchTechnologies();
            closeForm();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure? This will also remove the technology from all projects.")) return;
        
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/technologies/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete technology');
            
            setTechnologies(prev => prev.filter(tech => tech.id !== id));
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const openForm = (tech: Technology | null = null) => {
        setEditingTechnology(tech);
        setIsFormOpen(true);
        setError(null);
    };

    const closeForm = () => {
        setEditingTechnology(null);
        setIsFormOpen(false);
        setError(null);
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Manage Technologies</h2>
                <button onClick={() => openForm()} className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80">
                    Add New
                </button>
            </div>

            {isLoading && <p>Loading...</p>}
            
            {isFormOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4">{editingTechnology ? 'Edit' : 'Add'} Technology</h3>
                         {error && <p className="text-red-500 bg-red-100 p-3 rounded-md my-4 text-sm">{error}</p>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Technology Name (e.g., React)" required className="w-full p-2 border rounded"/>
                            <input name="icon" value={formData.icon || ''} onChange={handleInputChange} placeholder="Icon URL (e.g., https://.../react.svg)" className="w-full p-2 border rounded"/>
                            <div className="flex justify-end gap-4">
                                <button type="button" onClick={closeForm} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancel</button>
                                <button type="submit" className="bg-accent text-white font-bold py-2 px-4 rounded-lg">{editingTechnology ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {error && !isFormOpen && <p className="text-red-500 bg-red-100 p-3 rounded-md my-4">{error}</p>}

            <div className="space-y-4">
                {technologies.map(tech => (
                    <div key={tech.id} className="p-4 border rounded-lg flex justify-between items-center hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                            {tech.icon ? (
                                <img src={tech.icon} alt={tech.name} className="w-8 h-8 object-contain" />
                            ) : (
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs">?</div>
                            )}
                            <p className="font-bold text-lg">{tech.name}</p>
                        </div>
                        <div className="space-x-4 flex-shrink-0">
                            <button onClick={() => openForm(tech)} className="text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => handleDelete(tech.id)} className="text-red-600 hover:underline">Delete</button>
                        </div>
                    </div>
                ))}
                 {!isLoading && technologies.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No technologies found. Add one to get started!</p>
                )}
            </div>
        </div>
    );
};

export default TechnologyManager;
