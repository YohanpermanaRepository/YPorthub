import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Experience, Certification } from '../types';
import { API_BASE_URL } from '../config';

const initialFormData: Omit<Experience, 'id'> = {
    company: '', position: '', logo: '', description: '', startDate: '', endDate: '', certificationId: undefined
};

function normalizeToMonthInputValue(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    // Try to parse common legacy formats like "January 2020"
    const parsed = new Date(`${trimmed} 01`);
    if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }
    return '';
}

function formatMonthYear(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
        const [y, m] = trimmed.split('-').map(Number);
        const d = new Date(y, (m || 1) - 1, 1);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
        }
    }
    return value;
}

const ExperienceManager: React.FC = () => {
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [allCertifications, setAllCertifications] = useState<Certification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExperience, setEditingExperience] = useState<Experience | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const [formData, setFormData] = useState<Omit<Experience, 'id'>>(initialFormData);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [expResponse, certResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/experience`),
                fetch(`${API_BASE_URL}/certifications`)
            ]);
            if (!expResponse.ok) throw new Error('Failed to fetch experiences');
            if (!certResponse.ok) throw new Error('Failed to fetch certifications');
            
            const expData = await expResponse.json();
            const certData = await certResponse.json();
            
            setExperiences(expData);
            setAllCertifications(certData);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (editingExperience) {
            setFormData({
                company: editingExperience.company,
                position: editingExperience.position,
                logo: editingExperience.logo,
                description: editingExperience.description,
                startDate: normalizeToMonthInputValue(editingExperience.startDate) || editingExperience.startDate,
                endDate: editingExperience.endDate.trim().toLowerCase() === 'present'
                    ? 'Present'
                    : (normalizeToMonthInputValue(editingExperience.endDate) || editingExperience.endDate),
                certificationId: editingExperience.certificationId
            });
        } else {
            setFormData(initialFormData);
        }
    }, [editingExperience]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        if (name === 'isPresent') {
            setFormData(prev => ({ ...prev, endDate: checked ? 'Present' : '' }));
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]:
                name === 'certificationId'
                    ? (value ? parseInt(value) : undefined)
                    : type === 'checkbox'
                        ? checked
                        : value
        }));
    };
    
    const handleLogoUpload = async (file: File) => {
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setIsUploading(true);
        setError(null);
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: uploadFormData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Upload failed');
            
            setFormData(prev => ({...prev, logo: data.url}));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error. Please log in again.");

        const method = editingExperience ? 'PUT' : 'POST';
        const url = editingExperience 
            ? `${API_BASE_URL}/experience/${editingExperience.id}` 
            : `${API_BASE_URL}/experience`;

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error(`Failed to ${editingExperience ? 'update' : 'create'} experience`);
            
            await fetchData();
            closeForm();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure?")) return;
        
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/experience/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete experience');
            
            setExperiences(prev => prev.filter(exp => exp.id !== id));
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const openForm = (exp: Experience | null = null) => {
        setEditingExperience(exp);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setEditingExperience(null);
        setIsFormOpen(false);
        setError(null);
    };

    return (
        <div>
            {/* Crop Modal akan ditambahkan di sini jika diperlukan */}
            
            {isFormOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
                        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <span>💼</span>
                            {editingExperience ? 'Edit' : 'Add'} Experience
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-200 mb-2">Position</label>
                                    <input name="position" value={formData.position} onChange={handleInputChange} placeholder="e.g., Senior Developer" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-200 mb-2">Company</label>
                                    <input name="company" value={formData.company} onChange={handleInputChange} placeholder="e.g., TechCorp Inc." required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition"/>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-200 mb-2">Company Logo</label>
                                <div className="flex items-center gap-2">
                                    <input id="logo" name="logo" value={formData.logo} onChange={handleInputChange} placeholder="Logo URL" required className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition"/>
                                    <input 
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={(e) => e.target.files && handleLogoUpload(e.target.files[0])}
                                    />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap" disabled={isUploading}>
                                        {isUploading ? '⏳' : '📤'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-200 mb-2">Description</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Describe your role and achievements..." required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition resize-none" rows={4}></textarea>
                            </div>

                            <div className="bg-gray-700 bg-opacity-50 rounded-xl p-4 border border-gray-600">
                                <label className="block text-sm font-semibold text-gray-200 mb-4">Duration</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-300 mb-2">Start Date</label>
                                        <input
                                            type="month"
                                            name="startDate"
                                            value={normalizeToMonthInputValue(formData.startDate)}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-300 mb-2">End Date</label>
                                        <input
                                            type="month"
                                            name="endDate"
                                            value={normalizeToMonthInputValue(formData.endDate)}
                                            onChange={handleInputChange}
                                            required={formData.endDate !== 'Present'}
                                            disabled={formData.endDate === 'Present'}
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                                <label className="mt-3 flex items-center gap-2 text-sm text-gray-300 select-none cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="isPresent"
                                        checked={formData.endDate === 'Present'}
                                        onChange={handleInputChange}
                                        className="w-4 h-4 rounded bg-gray-700 border border-gray-600 cursor-pointer"
                                    />
                                    <span>Currently working here</span>
                                </label>
                            </div>

                            <div>
                                <label htmlFor="certificationId" className="block text-sm font-semibold text-gray-200 mb-2">Related Certification (Optional)</label>
                                <select 
                                    name="certificationId" 
                                    id="certificationId" 
                                    value={formData.certificationId || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition"
                                >
                                    <option value="">No Certification</option>
                                    {allCertifications.map(cert => (
                                        <option key={cert.id} value={cert.id}>{cert.name} - {cert.issuer}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-600">
                                <button type="button" onClick={closeForm} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-all">{editingExperience ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                            <span>💼</span>
                            Work Experience
                        </h2>
                        <p className="text-gray-400">Manage your professional experience</p>
                    </div>
                    <button onClick={() => openForm()} className="bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg">
                        + Add Experience
                    </button>
                </div>

                {isLoading && <p className="text-gray-400">Loading...</p>}
                {error && (
                    <div className="mb-6 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-50 rounded-lg p-4 flex items-center gap-3">
                        <span>❌</span>
                        <p className="text-red-200">{error}</p>
                    </div>
                )}
                
                <div className="space-y-4">
                    {experiences.map(exp => (
                        <div key={exp.id} className="bg-gray-700 bg-opacity-50 border border-gray-600 rounded-xl p-6 hover:bg-opacity-70 transition">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-white mb-1">{exp.position}</h3>
                                    <p className="text-navy-300 font-medium mb-2">@ {exp.company}</p>
                                    <p className="text-gray-400 text-sm mb-3">{formatMonthYear(exp.startDate)} - {formatMonthYear(exp.endDate)}</p>
                                    <p className="text-gray-300 text-sm leading-relaxed">{exp.description}</p>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-600">
                                <button onClick={() => openForm(exp)} className="text-navy-400 hover:text-navy-300 font-medium text-sm transition-colors">✏️ Edit</button>
                                <button onClick={() => handleDelete(exp.id)} className="text-red-400 hover:text-red-300 font-medium text-sm transition-colors">🗑️ Delete</button>
                            </div>
                        </div>
                    ))}
                    {!isLoading && experiences.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-400">No experiences yet. Add one to get started!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExperienceManager;
