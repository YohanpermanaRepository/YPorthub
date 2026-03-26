import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    BookOpen,
    Plus,
    Trash,
    Upload,
    X,
    Loader2,
    AlertCircle,
    Search,
    Check,
    Eye,
    ChevronDown,
    FileText,
    Award,
    Gift
} from 'lucide-react';
import type { EducationData, Publication, Achievement } from '../types';
import { API_BASE_URL } from '../config';

const initialFormData: Omit<EducationData, 'id'> = {
    institution: '', degree: '', major: '', logo: '', gpa: 0, predicate: '', scholarship: '',
    startDate: '', endDate: '', transcriptLink: '', publications: [], achievements: []
};

const EducationManager: React.FC = () => {
    const [educations, setEducations] = useState<EducationData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [sortField, setSortField] = useState<'degree' | 'institution' | 'gpa' | 'major' | 'predicate' | 'scholarship' | 'startDate'>('gpa');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingData, setEditingData] = useState<Partial<EducationData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEducation, setEditingEducation] = useState<EducationData | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState<Omit<EducationData, 'id'>>(initialFormData);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [expandedPublications, setExpandedPublications] = useState<Publication[]>([]);
    const [expandedAchievements, setExpandedAchievements] = useState<Achievement[]>([]);

    const fetchEducations = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/education`);
            if (!response.ok) throw new Error('Failed to fetch education data');
            setEducations(await response.json());
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEducations();
    }, [fetchEducations]);

    useEffect(() => {
        if (editingEducation) setFormData(editingEducation);
        else setFormData(initialFormData);
    }, [editingEducation]);

    const startEdit = (edu: EducationData) => {
        setEditingId(edu.id);
        setEditingData({ ...edu });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingData({});
    };

    const saveEdit = async () => {
        if (!editingId || !editingData.degree?.trim() || !editingData.institution?.trim()) {
            setError("Please fill in all required fields");
            return;
        }

        setIsSaving(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication error.");
            setIsSaving(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/education/${editingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editingData)
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(errData || 'Failed to update education');
            }

            await fetchEducations();
            setEditingId(null);
            setEditingData({});
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Delete this education?")) return;

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/education/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete education');
            setEducations(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedEducations.length && paginatedEducations.length > 0) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(paginatedEducations.map(e => e.id));
            setSelectedIds(allIds);
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Delete ${selectedIds.size} education(s)?`)) return;

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        const idsToDelete = Array.from(selectedIds);

        try {
            await Promise.all(
                idsToDelete.map(id =>
                    fetch(`${API_BASE_URL}/education/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                )
            );

            setEducations(prev => prev.filter(e => !idsToDelete.includes(e.id)));
            setSelectedIds(new Set());
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const toggleExpand = (edu: EducationData) => {
        if (expandedId === edu.id) {
            setExpandedId(null);
        } else {
            setExpandedId(edu.id);
            setExpandedPublications([...edu.publications]);
            setExpandedAchievements([...edu.achievements]);
        }
    };

    const saveExpandedItems = async (edu: EducationData) => {
        if (!editingData.degree?.trim() || !editingData.institution?.trim()) {
            setError("Please fill in all required fields");
            return;
        }

        setIsSaving(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication error.");
            setIsSaving(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/education/${edu.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...edu,
                    publications: expandedPublications,
                    achievements: expandedAchievements
                })
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(errData || 'Failed to update education');
            }

            await fetchEducations();
            setExpandedId(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const addPublication = () => {
        setExpandedPublications([
            ...expandedPublications,
            { title: '', authors: '', publisher: '', index: '', year: new Date().getFullYear(), link: '' }
        ]);
    };

    const removePublication = (index: number) => {
        setExpandedPublications(expandedPublications.filter((_, i) => i !== index));
    };

    const updatePublication = (index: number, field: string, value: any) => {
        const updated = [...expandedPublications];
        (updated[index] as any)[field] = value;
        setExpandedPublications(updated);
    };

    const addAchievement = () => {
        setExpandedAchievements([...expandedAchievements, { description: '', link: '' }]);
    };

    const removeAchievement = (index: number) => {
        setExpandedAchievements(expandedAchievements.filter((_, i) => i !== index));
    };

    const updateAchievement = (index: number, field: string, value: any) => {
        const updated = [...expandedAchievements];
        (updated[index] as any)[field] = value;
        setExpandedAchievements(updated);
    };

    // Filter educations based on search query
    const filteredEducations = educations.filter(edu =>
        edu.degree.toLowerCase().includes(searchQuery.toLowerCase()) ||
        edu.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        edu.major.toLowerCase().includes(searchQuery.toLowerCase()) ||
        edu.predicate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        edu.gpa.toString().includes(searchQuery)
    );

    // Sort educations
    const sortedEducations = [...filteredEducations].sort((a, b) => {
        let compareA: any = a[sortField];
        let compareB: any = b[sortField];

        if (typeof compareA === 'string' && typeof compareB === 'string') {
            compareA = compareA.toLowerCase();
            compareB = compareB.toLowerCase();
        }

        if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
        if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination calculations
    const totalPages = Math.ceil(sortedEducations.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedEducations = sortedEducations.slice(startIdx, endIdx);

    // Reset page if out of bounds
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [sortedEducations.length, currentPage, totalPages]);

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

            // Update both form data and editing data if in edit mode
            if (editingId) {
                setEditingData(prev => ({ ...prev, logo: data.url }));
            } else {
                setFormData(prev => ({ ...prev, logo: data.url }));
            }
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
        setIsSaving(true);
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
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const closeForm = () => {
        setEditingEducation(null);
        setIsFormOpen(false);
        setError(null);
    };

    const openForm = (edu: EducationData | null = null) => {
        setEditingEducation(edu);
        setIsFormOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-gray-800 p-4 rounded-2xl shadow-xl border border-gray-700">
            {/* Header */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Education
                    </h2>
                    <div className="flex gap-2">
                        {editingId && (
                            <>
                                <button
                                    onClick={saveEdit}
                                    disabled={isSaving}
                                    className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-1 px-4 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Check className="w-4 h-4" />
                                    Save
                                </button>
                                <button
                                    onClick={cancelEdit}
                                    disabled={isSaving}
                                    className="flex items-center gap-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </>
                        )}
                        {selectedIds.size > 0 && (
                            <button
                                onClick={deleteSelected}
                                className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-1 px-3 rounded-lg text-sm"
                            >
                                <Trash className="w-4 h-4" />
                                Delete ({selectedIds.size})
                            </button>
                        )}
                        <button
                            onClick={() => openForm()}
                            disabled={editingId !== null}
                            className="flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-1 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by degree, institution, major, or GPA..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-9 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-200 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-700 border-b border-gray-600 z-10">
                            <tr>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size > 0 && selectedIds.size === paginatedEducations.length && paginatedEducations.length > 0}
                                        onChange={toggleSelectAll}
                                        className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                    />
                                </th>
                                <th className="px-4 py-2 text-left text-gray-200 font-semibold w-12">No.</th>
                                <th
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('degree');
                                        setSortOrder(sortField === 'degree' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Degree {sortField === 'degree' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('institution');
                                        setSortOrder(sortField === 'institution' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Institution {sortField === 'institution' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('major');
                                        setSortOrder(sortField === 'major' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Major {sortField === 'major' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-2 text-center text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('gpa');
                                        setSortOrder(sortField === 'gpa' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    GPA {sortField === 'gpa' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('predicate');
                                        setSortOrder(sortField === 'predicate' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Predicate {sortField === 'predicate' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('scholarship');
                                        setSortOrder(sortField === 'scholarship' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Scholarship {sortField === 'scholarship' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold">Logo</th>
                                <th className="px-4 py-2 text-left text-gray-200 font-semibold">Transcript</th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold">Publications</th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold">Achievements</th>
                                <th
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('startDate');
                                        setSortOrder(sortField === 'startDate' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Duration {sortField === 'startDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {paginatedEducations.map((edu, index) => (
                                <>
                                <tr key={edu.id} className="hover:bg-gray-700/50 transition">
                                    <td className="px-4 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(edu.id)}
                                            onChange={() => toggleSelect(edu.id)}
                                            className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center text-gray-400 font-medium w-12">
                                        {startIdx + index + 1}
                                    </td>
                                    {editingId === edu.id ? (
                                        <>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingData.degree || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, degree: e.target.value }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingData.institution || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, institution: e.target.value }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingData.major || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, major: e.target.value }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editingData.gpa || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, gpa: parseFloat(e.target.value) || 0 }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingData.predicate || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, predicate: e.target.value }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingData.scholarship || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, scholarship: e.target.value }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {editingData.logo && (
                                                        <>
                                                            <img src={editingData.logo} alt="logo" className="w-6 h-6 rounded object-cover cursor-pointer hover:opacity-80" onClick={() => { if (editingData.logo) { setPreviewImageUrl(editingData.logo); setIsPreviewModalOpen(true); }}} />
                                                            <button type="button" onClick={() => setEditingData(prev => ({ ...prev, logo: '' }))} className="text-gray-400 hover:text-red-400 transition" title="Remove logo">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-blue-400 hover:text-blue-300 transition disabled:opacity-50">
                                                        <Upload className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <input
                                                    type="text"
                                                    value={editingData.transcriptLink || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, transcriptLink: e.target.value }))}
                                                    className="w-32 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 truncate"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center text-gray-300 text-xs">
                                                {editingData.publications?.length || 0}
                                            </td>
                                            <td className="px-4 py-2 text-center text-gray-300 text-xs">
                                                {editingData.achievements?.length || 0}
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <div className="flex gap-1">
                                                    <input
                                                        type="date"
                                                        value={editingData.startDate || ''}
                                                        onChange={(e) => setEditingData(prev => ({ ...prev, startDate: e.target.value }))}
                                                        className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                    />
                                                    <span className="text-gray-500 px-1">—</span>
                                                    <input
                                                        type="date"
                                                        value={editingData.endDate || ''}
                                                        onChange={(e) => setEditingData(prev => ({ ...prev, endDate: e.target.value }))}
                                                        className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => handleDelete(edu.id)}
                                                    className="text-red-400 hover:text-red-300 transition"
                                                    title="Delete"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-2 text-white font-medium cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(edu)}>
                                                {edu.degree}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(edu)}>
                                                {edu.institution}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition text-xs" onClick={() => startEdit(edu)}>
                                                {edu.major}
                                            </td>
                                            <td className="px-4 py-2 text-center text-gray-300 cursor-pointer hover:bg-gray-600/50 text-xs" onClick={() => startEdit(edu)}>
                                                {edu.gpa}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => startEdit(edu)}>
                                                {edu.predicate}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => startEdit(edu)}>
                                                {edu.scholarship || '—'}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {edu.logo ? (
                                                    <img src={edu.logo} alt="logo" className="w-6 h-6 rounded object-cover" />
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                {edu.transcriptLink ? (
                                                    <a href={edu.transcriptLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate block max-w-xs" title={edu.transcriptLink}>
                                                        View →
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-center text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => startEdit(edu)}>
                                                <span className="inline-block bg-blue-500/30 px-2 py-1 rounded text-blue-300 font-semibold">
                                                    {edu.publications?.length || 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-center text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => startEdit(edu)}>
                                                <span className="inline-block bg-emerald-500/30 px-2 py-1 rounded text-emerald-300 font-semibold">
                                                    {edu.achievements?.length || 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => startEdit(edu)}>
                                                {edu.startDate} — {edu.endDate}
                                            </td>
                                            <td className="px-4 py-2 text-center flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => toggleExpand(edu)}
                                                    className={`text-blue-400 hover:text-blue-300 transition transform ${expandedId === edu.id ? 'rotate-180' : ''}`}
                                                    title={expandedId === edu.id ? 'Collapse' : 'Expand'}
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(edu.id)}
                                                    className="text-red-400 hover:text-red-300 transition"
                                                    title="Delete"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                                {expandedId === edu.id && (
                                    <tr className="bg-gray-700/50 border-t-2 border-blue-500/50">
                                        <td colSpan={13} className="px-4 py-4">
                                            <div className="space-y-4">
                                                {/* Publications Section */}
                                                <div>
                                                    <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                                                        <FileText className="w-4 h-4" />
                                                        <span>Publications ({expandedPublications.length})</span>
                                                        <button type="button" onClick={addPublication} className="ml-auto bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                                            <Plus className="w-3 h-3" /> Add
                                                        </button>
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {expandedPublications.map((pub, idx) => (
                                                            <div key={idx} className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                                                                <div className="flex gap-2 mb-2">
                                                                    <input value={pub.title} onChange={(e) => updatePublication(idx, 'title', e.target.value)} placeholder="Title" className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400" />
                                                                    <button type="button" onClick={() => removePublication(idx)} className="text-red-400 hover:text-red-300 transition">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                                    <input value={pub.authors} onChange={(e) => updatePublication(idx, 'authors', e.target.value)} placeholder="Authors" className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400" />
                                                                    <input value={pub.publisher} onChange={(e) => updatePublication(idx, 'publisher', e.target.value)} placeholder="Publisher" className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400" />
                                                                    <input value={pub.index} onChange={(e) => updatePublication(idx, 'index', e.target.value)} placeholder="Index" className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400" />
                                                                    <input type="number" value={pub.year} onChange={(e) => updatePublication(idx, 'year', parseInt(e.target.value) || new Date().getFullYear())} placeholder="Year" className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400" />
                                                                </div>
                                                                <input value={pub.link || ''} onChange={(e) => updatePublication(idx, 'link', e.target.value)} placeholder="Link (Optional)" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Achievements Section */}
                                                <div>
                                                    <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                                                        <Award className="w-4 h-4" />
                                                        <span>Achievements ({expandedAchievements.length})</span>
                                                        <button type="button" onClick={addAchievement} className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                                            <Plus className="w-3 h-3" /> Add
                                                        </button>
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {expandedAchievements.map((ach, idx) => (
                                                            <div key={idx} className="bg-gray-800 p-3 rounded-lg border border-gray-600">
                                                                <div className="flex gap-2 mb-2">
                                                                    <input value={ach.description} onChange={(e) => updateAchievement(idx, 'description', e.target.value)} placeholder="Description" className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-emerald-400" />
                                                                    <button type="button" onClick={() => removeAchievement(idx)} className="text-red-400 hover:text-red-300 transition">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                <input value={ach.link || ''} onChange={(e) => updateAchievement(idx, 'link', e.target.value)} placeholder="Link (Optional)" className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-emerald-400" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Save/Cancel Buttons */}
                                                <div className="flex gap-2 pt-3 border-t border-gray-600">
                                                    <button type="button" onClick={() => setExpandedId(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-semibold transition">
                                                        Cancel
                                                    </button>
                                                    <button type="button" onClick={() => { const edu = educations.find(e => e.id === expandedId); if (edu) saveExpandedItems(edu); }} disabled={isSaving} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-3 py-1.5 rounded text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1">
                                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {sortedEducations.length > 0 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                        <div className="text-sm text-gray-400">
                            Showing {startIdx + 1} to {Math.min(endIdx, sortedEducations.length)} of {sortedEducations.length} items
                        </div>

                        {totalPages > 1 && (
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
                                >
                                    ← Prev
                                </button>

                                <div className="flex gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                                                currentPage === page
                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {educations.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                    No education yet. Click "Add" to create one!
                </div>
            )}

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 p-4 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">
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
                                    <input name="institution" value={formData.institution} onChange={handleInputChange} placeholder="e.g., University of Computer Science" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Degree</label>
                                    <input name="degree" value={formData.degree} onChange={handleInputChange} placeholder="e.g., Bachelor of Science" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Major</label>
                                    <input name="major" value={formData.major} onChange={handleInputChange} placeholder="e.g., Computer Science" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">GPA</label>
                                    <input name="gpa" type="number" step="0.01" value={formData.gpa} onChange={handleInputChange} placeholder="e.g., 3.8" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Predicate</label>
                                    <input name="predicate" value={formData.predicate} onChange={handleInputChange} placeholder="e.g., Cum Laude" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Scholarship</label>
                                    <input name="scholarship" value={formData.scholarship || ''} onChange={handleInputChange} placeholder="e.g., Full Tuition (Optional)" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Institution Logo</label>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <input name="logo" value={formData.logo} onChange={handleInputChange} placeholder="Logo URL" required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition pr-10" />
                                        {formData.logo && <Check className="absolute right-3 top-3 text-emerald-500" size={18} />}
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
                                        <input name="startDate" type="date" value={formData.startDate} onChange={handleInputChange} required className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1.5 ml-1">End Date</label>
                                        <input name="endDate" type="date" value={formData.endDate} onChange={handleInputChange} required className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">Transcript Link</label>
                                <input name="transcriptLink" value={formData.transcriptLink} onChange={handleInputChange} placeholder="https://..." required className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                            </div>

                            <hr className="border-gray-700" />
                            <h4 className="font-bold text-white text-lg">Publications</h4>
                            {formData.publications.map((p, i) => (
                                <div key={i} className="p-4 border border-gray-700 rounded-xl space-y-3 bg-gray-800/30">
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <input value={p.title} onChange={e => handleDepChange(i, 'title', e.target.value, 'publications')} placeholder="Title" className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                        <button type="button" onClick={() => removeDep(i, 'publications')} className="text-gray-400 hover:text-red-400 font-bold text-xl transition-colors flex-shrink-0">&times;</button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <input value={p.authors} onChange={e => handleDepChange(i, 'authors', e.target.value, 'publications')} placeholder="Authors" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                        <input value={p.publisher} onChange={e => handleDepChange(i, 'publisher', e.target.value, 'publications')} placeholder="Publisher" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                        <input value={p.index} onChange={e => handleDepChange(i, 'index', e.target.value, 'publications')} placeholder="Index (e.g., SINTA 2)" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                        <input type="number" value={p.year} onChange={e => handleDepChange(i, 'year', parseInt(e.target.value) || new Date().getFullYear(), 'publications')} placeholder="Year" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                    </div>
                                    <input value={p.link || ''} onChange={e => handleDepChange(i, 'link', e.target.value, 'publications')} placeholder="Link (Optional)" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                </div>
                            ))}
                            <button type="button" onClick={() => addDep('publications')} className="text-white text-sm font-semibold flex items-center gap-1 hover:text-gray-200 transition-colors">
                                <Plus size={16} /> Add Publication
                            </button>

                            <hr className="border-gray-700" />
                            <h4 className="font-bold text-white text-lg">Achievements</h4>
                            {formData.achievements.map((a, i) => (
                                <div key={i} className="p-4 border border-gray-700 rounded-xl space-y-3 bg-gray-800/30">
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <input value={a.description} onChange={e => handleDepChange(i, 'description', e.target.value, 'achievements')} placeholder="Description" className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                        <button type="button" onClick={() => removeDep(i, 'achievements')} className="text-gray-400 hover:text-red-400 font-bold text-xl transition-colors flex-shrink-0">&times;</button>
                                    </div>
                                    <input value={a.link || ''} onChange={e => handleDepChange(i, 'link', e.target.value, 'achievements')} placeholder="Link (Optional)" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 transition" />
                                </div>
                            ))}
                            <button type="button" onClick={() => addDep('achievements')} className="text-white text-sm font-semibold flex items-center gap-1 hover:text-gray-200 transition-colors">
                                <Plus size={16} /> Add Achievement
                            </button>

                            <div className="flex gap-2 pt-4 border-t border-gray-800">
                                <button type="button" onClick={closeForm} className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-sm">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSaving} className="flex-[2] py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 disabled:opacity-50 text-sm">
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : null}
                                    {editingEducation ? 'Update Education' : 'Save Education'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {isPreviewModalOpen && previewImageUrl && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="relative max-w-full max-h-[70vh] flex items-center justify-center">
                        <img src={previewImageUrl} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                        <button onClick={() => { setIsPreviewModalOpen(false); setPreviewImageUrl(null); }} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EducationManager;
