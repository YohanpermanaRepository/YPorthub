import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Briefcase, 
    Plus, 
    Pencil, 
    Trash2, 
    Upload, 
    X, 
    Building2, 
    Calendar, 
    Loader2, 
    CheckCircle2, 
    AlertCircle 
} from 'lucide-react';
import type { Experience, Certification } from '../types';
import { API_BASE_URL } from '../config';

const initialFormData: Omit<Experience, 'id'> = {
    company: '', position: '', logo: '', description: '', startDate: '', endDate: '', certificationId: undefined
};

// Backend GET kemungkinan mengembalikan field relasi dengan nama berbeda.
// Kita normalisasi agar form select tetap terisi dan payload update sesuai.
function normalizeExperience(input: any): Experience {
    const relatedCertificationId =
        input?.certificationId !== undefined
            ? input.certificationId
            : input?.relatedCertificationId;

    return {
        ...input,
        id: Number(input?.id),
        company: String(input?.company ?? ''),
        position: String(input?.position ?? ''),
        logo: String(input?.logo ?? ''),
        description: String(input?.description ?? ''),
        startDate: String(input?.startDate ?? ''),
        endDate: String(input?.endDate ?? ''),
        certificationId: relatedCertificationId !== undefined && relatedCertificationId !== null
            ? Number(relatedCertificationId)
            : undefined,
    };
}

// Helper: Ubah format tanggal API ke format input month (YYYY-MM)
function normalizeToMonthInputValue(value: string): string {
    if (!value || value.toLowerCase() === 'present') return '';
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    
    const parsed = new Date(`${trimmed}-01`);
    if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }
    return '';
}

// Helper: Format tampilan tanggal (e.g., Jan 2020)
function formatMonthYear(value: string): string {
    if (!value) return '';
    if (value.toLowerCase() === 'present') return 'Present';
    
    const trimmed = value.trim();
    const [y, m] = trimmed.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    
    if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }
    return value;
}

const ExperienceManager: React.FC = () => {
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [allCertifications, setAllCertifications] = useState<Certification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            if (!expResponse.ok || !certResponse.ok) throw new Error('Failed to fetch data');
            
            const expData = await expResponse.json();
            setExperiences(Array.isArray(expData) ? expData.map(normalizeExperience) : []);
            setAllCertifications(await certResponse.json());
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
                ...editingExperience,
                startDate: normalizeToMonthInputValue(editingExperience.startDate),
                endDate: editingExperience.endDate.toLowerCase() === 'present' 
                    ? 'Present' 
                    : normalizeToMonthInputValue(editingExperience.endDate)
            });
        } else {
            setFormData(initialFormData);
        }
    }, [editingExperience]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (name === 'isPresent') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, endDate: checked ? 'Present' : '' }));
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: name === 'certificationId' 
                ? (value ? parseInt(value) : undefined) 
                : value
        }));
    };
    
    const handleLogoUpload = async (file: File) => {
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setIsUploading(true);
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
        setIsSubmitting(true);
        const token = localStorage.getItem('authToken');
        
        const method = editingExperience ? 'PUT' : 'POST';
        const url = editingExperience 
            ? `${API_BASE_URL}/experience/${editingExperience.id}` 
            : `${API_BASE_URL}/experience`;

        try {
            // Backend mengharapkan `relatedCertificationId`.
            // Untuk case "None", kita paksa kirim `relatedCertificationId: null`
            // supaya relasi benar-benar di-clear.
            const payload: any = { ...formData };
            payload.relatedCertificationId = payload.certificationId ?? null;
            delete payload.certificationId;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || errData?.error || `Failed to save experience`);
            }
            
            await fetchData();
            closeForm();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure?")) return;
        const token = localStorage.getItem('authToken');
        try {
            const response = await fetch(`${API_BASE_URL}/experience/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete');
            setExperiences(prev => prev.filter(exp => exp.id !== id));
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const closeForm = () => {
        setEditingExperience(null);
        setIsFormOpen(false);
        setError(null);
    };

    return (
        <div className="p-4">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Briefcase className="text-navy-400" size={24} />
                        Experience Manager
                    </h2>
                    <p className="text-gray-400">Add or update your professional journey</p>
                </div>
                <button 
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center justify-center gap-1 bg-navy-600 hover:bg-navy-500 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg active:scale-95 text-sm"
                >
                    <Plus size={20} />
                    Add Experience
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
                    <p>Loading experiences...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {experiences.map(exp => (
                        <div key={exp.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-all group">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-600">
                                    {exp.logo ? (
                                        <img src={exp.logo} alt={exp.company} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 className="text-gray-500" size={30} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-navy-400 transition-colors">{exp.position}</h3>
                                            <p className="text-gray-300 font-medium">@ {exp.company}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingExperience(exp); setIsFormOpen(true); }} className="p-2 bg-gray-700 hover:bg-navy-600 text-gray-300 hover:text-white rounded-lg transition-colors">
                                                <Pencil size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(exp.id)} className="p-2 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mt-2 mb-3">
                                        <Calendar size={14} />
                                        <span>{formatMonthYear(exp.startDate)} — {formatMonthYear(exp.endDate)}</span>
                                    </div>
                                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 md:line-clamp-none">
                                        {exp.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {experiences.length === 0 && (
                        <div className="text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
                            <Building2 className="mx-auto text-gray-600 mb-4" size={48} />
                            <p className="text-gray-400 italic">No experience data available.</p>
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
                                {editingExperience ? <Pencil className="text-navy-400" size={18} /> : <Plus className="text-navy-400" size={18} />}
                                {editingExperience ? 'Edit' : 'Add'} Experience
                            </h3>
                            <button onClick={closeForm} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Position</label>
                                    <input name="position" value={formData.position} onChange={handleInputChange} placeholder="e.g., Senior Developer" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Company</label>
                                    <input name="company" value={formData.company} onChange={handleInputChange} placeholder="e.g., Google" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Company Logo</label>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <input name="logo" value={formData.logo} onChange={handleInputChange} placeholder="Logo URL" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition pr-10"/>
                                        {formData.logo && <CheckCircle2 className="absolute right-3 top-3 text-emerald-500" size={18} />}
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files && handleLogoUpload(e.target.files[0])} />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all disabled:opacity-50" disabled={isUploading}>
                                        {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Describe your responsibilities..." required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition min-h-[120px]" rows={4}></textarea>
                            </div>

                            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
                                <label className="block text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                                    <Calendar size={16} /> Duration
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1.5 ml-1">Start Date</label>
                                        <input
                                            type="month"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1.5 ml-1">End Date</label>
                                        <input
                                            type="month"
                                            name="endDate"
                                            value={formData.endDate === 'Present' ? '' : formData.endDate}
                                            onChange={handleInputChange}
                                            required={formData.endDate !== 'Present'}
                                            disabled={formData.endDate === 'Present'}
                                            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer select-none group w-fit">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            name="isPresent"
                                            checked={formData.endDate === 'Present'}
                                            onChange={handleInputChange}
                                            className="sr-only"
                                        />
                                        <div className={`w-10 h-5 rounded-full transition-colors ${formData.endDate === 'Present' ? 'bg-navy-500' : 'bg-gray-600'}`}></div>
                                        <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${formData.endDate === 'Present' ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span>I am currently working in this role</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Related Certification</label>
                                <select 
                                    name="certificationId" 
                                    value={formData.certificationId !== undefined && formData.certificationId !== null ? String(formData.certificationId) : ''} 
                                    onChange={handleInputChange} 
                                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"
                                >
                                    <option value="">None</option>
                                    {allCertifications.map(cert => (
                                        <option key={cert.id} value={cert.id}>{cert.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-gray-800">
                                <button type="button" onClick={closeForm} className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-sm">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="flex-[2] py-2 px-4 bg-navy-600 hover:bg-navy-500 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 text-sm">
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                                    {editingExperience ? 'Update Experience' : 'Save Experience'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExperienceManager;