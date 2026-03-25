import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    Plus,
    Pencil,
    Trash2,
    X,
    Loader2,
    AlertCircle,
    Code2
} from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Technology {
  id: number;
  name: string;
  icon: string | null;
}

const TechnologyManager: React.FC = () => {
    const [technologies, setTechnologies] = useState<Technology[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        setIsSubmitting(true);
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
        } finally {
            setIsSubmitting(false);
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
        <div className="p-4">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Zap className="text-navy-400" size={24} />
                        Technology Manager
                    </h2>
                    <p className="text-gray-400 text-sm">Manage your technical skills and tools</p>
                </div>
                <button 
                    onClick={() => openForm()}
                    className="flex items-center justify-center gap-1 bg-navy-600 hover:bg-navy-500 text-white font-semibold py-2 px-3 rounded-lg transition-all shadow-lg active:scale-95 text-sm"
                >
                    <Plus size={20} />
                    Add Technology
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-3 bg-red-500/10 border border-red-500/50 rounded-lg p-2 flex items-center gap-2 text-red-200">
                    <AlertCircle size={16} />
                    <p className="text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200"><X size={18} /></button>
                </div>
            )}

            {/* Main List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Loader2 className="animate-spin mb-4" size={40} />
                    <p>Loading technologies...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {technologies.map(tech => (
                        <div key={tech.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-600">
                                    {tech.icon ? (
                                        <img src={tech.icon} alt={tech.name} className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <Code2 className="text-gray-500" size={24} />
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openForm(tech)} className="p-2 bg-gray-700 hover:bg-navy-600 text-gray-300 hover:text-white rounded-lg transition-colors">
                                        <Pencil size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(tech.id)} className="p-2 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white group-hover:text-navy-400 transition-colors">{tech.name}</h3>
                        </div>
                    ))}
                    
                    {technologies.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
                            <Zap className="mx-auto text-gray-600 mb-4" size={48} />
                            <p className="text-gray-400 italic">No technologies found. Add one to get started!</p>
                        </div>
                    )}
                </div>
            )}

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 p-4 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {editingTechnology ? <Pencil className="text-navy-400" size={18} /> : <Plus className="text-navy-400" size={18} />}
                                {editingTechnology ? 'Edit' : 'Add'} Technology
                            </h3>
                            <button onClick={closeForm} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Technology Name</label>
                                <input name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., React, TypeScript" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Icon URL</label>
                                <input name="icon" value={formData.icon || ''} onChange={handleInputChange} placeholder="https://..." className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                {formData.icon && (
                                    <div className="mt-3 flex justify-center">
                                        <img src={formData.icon} alt="Tech Icon Preview" className="w-12 h-12 object-contain" />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-gray-800">
                                <button type="button" onClick={closeForm} className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-sm">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="flex-[2] py-2 px-4 bg-navy-600 hover:bg-navy-500 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 disabled:opacity-50 text-sm">
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                                    {editingTechnology ? 'Update Technology' : 'Save Technology'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechnologyManager;
