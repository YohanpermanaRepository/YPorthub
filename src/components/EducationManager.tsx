import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    
    const openForm = (edu: EducationData | null = null) => { setEditingEducation(edu); setIsFormOpen(true); };
    const closeForm = () => { setEditingEducation(null); setIsFormOpen(false); setError(null); };

    return (
        <div className="bg-white p-8 rounded-lg shadow">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Manage Education</h2>
                <button onClick={() => openForm()} className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80">Add New</button>
            </div>
            {isLoading && <p>Loading...</p>}
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-md my-4">{error}</p>}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-6">{editingEducation ? 'Edit' : 'Add'} Education</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Main fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input name="institution" value={formData.institution} onChange={handleInputChange} placeholder="Institution" required className="w-full p-2 border rounded"/>
                                <div>
                                    <label htmlFor="logo" className="sr-only">Logo URL</label>
                                    <div className="flex items-center gap-2">
                                    <input id="logo" name="logo" value={formData.logo} onChange={handleInputChange} placeholder="Logo URL" required className="w-full p-2 border rounded"/>
                                        <input 
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            ref={fileInputRef}
                                            onChange={(e) => e.target.files && handleLogoUpload(e.target.files[0])}
                                        />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm bg-gray-600 text-white font-semibold px-3 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400" disabled={isUploading}>
                                            {isUploading ? '...' : 'Upload'}
                                        </button>
                                    </div>
                                </div>
                                <input name="degree" value={formData.degree} onChange={handleInputChange} placeholder="Degree" required className="w-full p-2 border rounded"/>
                                <input name="major" value={formData.major} onChange={handleInputChange} placeholder="Major" required className="w-full p-2 border rounded"/>
                                <input name="gpa" type="number" step="0.01" value={formData.gpa} onChange={handleInputChange} placeholder="GPA" required className="w-full p-2 border rounded"/>
                                <input name="predicate" value={formData.predicate} onChange={handleInputChange} placeholder="Predicate" required className="w-full p-2 border rounded"/>
                                <input name="startDate" value={formData.startDate} onChange={handleInputChange} placeholder="Start Date" required className="w-full p-2 border rounded"/>
                                <input name="endDate" value={formData.endDate} onChange={handleInputChange} placeholder="End Date" required className="w-full p-2 border rounded"/>
                                <input name="scholarship" value={formData.scholarship || ''} onChange={handleInputChange} placeholder="Scholarship (Optional)" className="w-full p-2 border rounded md:col-span-2"/>
                                <input name="transcriptLink" value={formData.transcriptLink} onChange={handleInputChange} placeholder="Transcript Link" required className="w-full p-2 border rounded md:col-span-2"/>
                            </div>
                            
                            <hr className="my-6"/>
                            <h4 className="font-bold">Publications</h4>
                            {formData.publications.map((p, i) => (
                                <div key={i} className="p-3 border rounded space-y-2 bg-gray-50 relative">
                                    <input value={p.title} onChange={e => handleDepChange(i, 'title', e.target.value, 'publications')} placeholder="Title" className="w-full p-2 border rounded"/>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <input value={p.authors} onChange={e => handleDepChange(i, 'authors', e.target.value, 'publications')} placeholder="Authors" className="w-full p-2 border rounded"/>
                                        <input value={p.publisher} onChange={e => handleDepChange(i, 'publisher', e.target.value, 'publications')} placeholder="Publisher" className="w-full p-2 border rounded"/>
                                        <input value={p.index} onChange={e => handleDepChange(i, 'index', e.target.value, 'publications')} placeholder="Index (e.g., SINTA 2)" className="w-full p-2 border rounded"/>
                                        <input type="number" value={p.year} onChange={e => handleDepChange(i, 'year', parseInt(e.target.value) || new Date().getFullYear(), 'publications')} placeholder="Year" className="w-full p-2 border rounded"/>
                                    </div>
                                    <input value={p.link || ''} onChange={e => handleDepChange(i, 'link', e.target.value, 'publications')} placeholder="Link (Optional)" className="w-full p-2 border rounded"/>
                                    <button type="button" onClick={() => removeDep(i, 'publications')} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold text-xl">&times;</button>
                                </div>
                            ))}
                            <button type="button" onClick={() => addDep('publications')} className="text-accent text-sm font-semibold">+ Add Publication</button>
                            
                            <hr className="my-6"/>
                            <h4 className="font-bold">Achievements</h4>
                            {formData.achievements.map((a, i) => (
                                <div key={i} className="p-3 border rounded space-y-2 bg-gray-50 relative">
                                    <input value={a.description} onChange={e => handleDepChange(i, 'description', e.target.value, 'achievements')} placeholder="Description" className="w-full p-2 border rounded"/>
                                    <input value={a.link || ''} onChange={e => handleDepChange(i, 'link', e.target.value, 'achievements')} placeholder="Link (Optional)" className="w-full p-2 border rounded"/>
                                    <button type="button" onClick={() => removeDep(i, 'achievements')} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold text-xl">&times;</button>
                                </div>
                            ))}
                            <button type="button" onClick={() => addDep('achievements')} className="text-accent text-sm font-semibold">+ Add Achievement</button>

                            <div className="flex justify-end gap-4 pt-6">
                                <button type="button" onClick={closeForm} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancel</button>
                                <button type="submit" className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-80">{editingEducation ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="space-y-4">
                {educations.map(edu => (
                    <div key={edu.id} className="p-4 border rounded-lg flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="font-bold text-lg">{edu.degree}</p>
                          <p className="text-md text-gray-700">{edu.institution}</p>
                        </div>
                        <div className="space-x-4 flex-shrink-0">
                            <button onClick={() => openForm(edu)} className="text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => handleDelete(edu.id)} className="text-red-600 hover:underline">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EducationManager;
