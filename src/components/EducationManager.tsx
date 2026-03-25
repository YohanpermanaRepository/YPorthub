import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    BookOpen,
    Plus,
    Pencil,
    Trash2,
    Upload,
    X,
    Loader2,
    AlertCircle,
    CheckCircle2,
    GraduationCap
} from 'lucide-react';
import type { EducationData, Publication, Achievement } from '../types';
import { API_BASE_URL } from '../config';

// Define initial form data OUTSIDE the component to prevent re-creation on every render.
const initialFormData: Omit<EducationData, 'id'> = {
    institution: '', degree: '', major: '', logo: '', gpa: 0, predicate: '', scholarship: '',
    startDate: '', endDate: '', transcriptLink: '', publications: [], achievements: []
};

const EducationManager: React.FC = () => {
    const [educations, setEducations] = useState<EducationData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEducation, setEditingEducation] = useState<EducationData | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [formData, setFormData] = useState<Omit<EducationData, 'id'>>(initialFormData);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const fetchEducations = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/education`);
            if (!response.ok) throw new Error('Failed to fetch education data');
            setEducations(await response.json());
        } catch (err) { setError((err as Error).message); } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchEducations(); }, [fetchEducations]);

    // This effect now correctly populates the form for editing or resets it for a new entry.
    useEffect(() => {
        if (editingEducation) setFormData(editingEducation);
        else setFormData(initialFormData);
    }, [editingEducation]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
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


    const handleDepChange = (index: number, field: string, value: string | number, type: 'publications' | 'achievements') => {
        const newDeps = [...formData[type]];
        (newDeps[index] as any)[field] = value;
        setFormData(prev => ({ ...prev, [type]: newDeps }));
    };

    const addDep = (type: 'publications' | 'achievements') => {
        const newItem = type === 'publications' 
            ? { title: '', authors: '', publisher: '', index: '', year: new Date().getFullYear(), link: '' }
            : { description: '', link: '' };
        setFormData(prev => ({ ...prev, [type]: [...prev[type], newItem] }));
    };

    const removeDep = (index: number, type: 'publications' | 'achievements') => {
        setFormData(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        const method = editingEducation ? 'PUT' : 'POST';
        const url = editingEducation ? `${API_BASE_URL}/education/${editingEducation.id}` : `${API_BASE_URL}/education`;

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.message || `Failed to ${editingEducation ? 'update' : 'create'} education`);
            }
            
            await fetchEducations();
            closeForm();
        } catch (err) { setError((err as Error).message); }
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure?")) return;
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/education/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete education');
            setEducations(prev => prev.filter(e => e.id !== id));
        } catch (err) { setError((err as Error).message); }
    };
    
    const openForm = (edu: EducationData | null = null) => { 
        setEditingEducation(edu); 
        setIsFormOpen(true); 
    };
    
    const closeForm = () => { 
        setEditingEducation(null); 
        setIsFormOpen(false); 
        setError(null); 
    };

    return (
        <div className="p-4">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <GraduationCap className="text-navy-400" size={24} />
                        Education Manager
                    </h2>
                    <p className="text-gray-400 text-sm">Track your academic achievements and qualifications</p>
                </div>
                <button 
                    onClick={() => openForm()}
                    className="flex items-center justify-center gap-1 bg-navy-600 hover:bg-navy-500 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg active:scale-95 text-sm"
                >
                    <Plus size={20} />
                    Add Education
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
                    <p>Loading education...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {educations.map(edu => (
                        <div key={edu.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-all group">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-600">
                                    {edu.logo ? (
                                        <img src={edu.logo} alt={edu.institution} className="w-full h-full object-cover" />
                                    ) : (
                                        <BookOpen className="text-gray-500" size={30} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-navy-400 transition-colors">{edu.degree}</h3>
                                            <p className="text-gray-300 font-medium">@ {edu.institution}</p>
                                            <p className="text-gray-400 text-sm mt-1">{edu.major} {edu.gpa ? `• GPA: ${edu.gpa}` : ''}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingEducation(edu); setIsFormOpen(true); }} className="p-2 bg-gray-700 hover:bg-navy-600 text-gray-300 hover:text-white rounded-lg transition-colors">
                                                <Pencil size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(edu.id)} className="p-2 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-gray-400 text-sm mt-3">{edu.startDate} — {edu.endDate}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {educations.length === 0 && (
                        <div className="text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
                            <GraduationCap className="mx-auto text-gray-600 mb-4" size={48} />
                            <p className="text-gray-400 italic">No education data available.</p>
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
                                {editingEducation ? <Pencil className="text-navy-400" size={18} /> : <Plus className="text-navy-400" size={18} />}
                                {editingEducation ? 'Edit' : 'Add'} Education
                            </h3>
                            <button onClick={closeForm} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Institution</label>
                                    <input name="institution" value={formData.institution} onChange={handleInputChange} placeholder="e.g., University of Computer Science" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Degree</label>
                                    <input name="degree" value={formData.degree} onChange={handleInputChange} placeholder="e.g., Bachelor of Science" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Major</label>
                                    <input name="major" value={formData.major} onChange={handleInputChange} placeholder="e.g., Computer Science" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">GPA</label>
                                    <input name="gpa" type="number" step="0.01" value={formData.gpa} onChange={handleInputChange} placeholder="e.g., 3.8" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Predicate</label>
                                    <input name="predicate" value={formData.predicate} onChange={handleInputChange} placeholder="e.g., Cum Laude" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Scholarship</label>
                                    <input name="scholarship" value={formData.scholarship || ''} onChange={handleInputChange} placeholder="e.g., Full Tuition (Optional)" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Institution Logo</label>
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

                            <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
                                <label className="block text-sm font-semibold text-gray-300 mb-4">Duration</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1.5 ml-1">Start Date</label>
                                        <input name="startDate" value={formData.startDate} onChange={handleInputChange} placeholder="2020-01-01" required className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1.5 ml-1">End Date</label>
                                        <input name="endDate" value={formData.endDate} onChange={handleInputChange} placeholder="2024-06-30" required className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Transcript Link</label>
                                <input name="transcriptLink" value={formData.transcriptLink} onChange={handleInputChange} placeholder="https://..." required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"/>
                            </div>
                            
                            <hr className="border-gray-700"/>
                            <h4 className="font-bold text-white text-lg">Publications</h4>
                            {formData.publications.map((p, i) => (
                                <div key={i} className="p-4 border border-gray-700 rounded-xl space-y-3 bg-gray-800/30">
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <input value={p.title} onChange={e => handleDepChange(i, 'title', e.target.value, 'publications')} placeholder="Title" className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                        <button type="button" onClick={() => removeDep(i, 'publications')} className="text-gray-400 hover:text-red-400 font-bold text-xl transition-colors flex-shrink-0">&times;</button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input value={p.authors} onChange={e => handleDepChange(i, 'authors', e.target.value, 'publications')} placeholder="Authors" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                        <input value={p.publisher} onChange={e => handleDepChange(i, 'publisher', e.target.value, 'publications')} placeholder="Publisher" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                        <input value={p.index} onChange={e => handleDepChange(i, 'index', e.target.value, 'publications')} placeholder="Index (e.g., SINTA 2)" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                        <input type="number" value={p.year} onChange={e => handleDepChange(i, 'year', parseInt(e.target.value) || new Date().getFullYear(), 'publications')} placeholder="Year" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                    </div>
                                    <input value={p.link || ''} onChange={e => handleDepChange(i, 'link', e.target.value, 'publications')} placeholder="Link (Optional)" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                </div>
                            ))}
                            <button type="button" onClick={() => addDep('publications')} className="text-white text-sm font-semibold flex items-center gap-1 hover:text-gray-200 transition-colors">
                                <Plus size={16} /> Add Publication
                            </button>
                            
                            <hr className="border-gray-700"/>
                            <h4 className="font-bold text-white text-lg">Achievements</h4>
                            {formData.achievements.map((a, i) => (
                                <div key={i} className="p-4 border border-gray-700 rounded-xl space-y-3 bg-gray-800/30">
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <input value={a.description} onChange={e => handleDepChange(i, 'description', e.target.value, 'achievements')} placeholder="Description" className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                        <button type="button" onClick={() => removeDep(i, 'achievements')} className="text-gray-400 hover:text-red-400 font-bold text-xl transition-colors flex-shrink-0">&times;</button>
                                    </div>
                                    <input value={a.link || ''} onChange={e => handleDepChange(i, 'link', e.target.value, 'achievements')} placeholder="Link (Optional)" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-navy-500 transition"/>
                                </div>
                            ))}
                            <button type="button" onClick={() => addDep('achievements')} className="text-white text-sm font-semibold flex items-center gap-1 hover:text-gray-200 transition-colors">
                                <Plus size={16} /> Add Achievement
                            </button>

                            <div className="flex gap-2 pt-4 border-t border-gray-800">
                                <button type="button" onClick={closeForm} className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-sm">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="flex-[2] py-2 px-4 bg-navy-600 hover:bg-navy-500 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 disabled:opacity-50 text-sm">
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                                    {editingEducation ? 'Update Education' : 'Save Education'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EducationManager;
