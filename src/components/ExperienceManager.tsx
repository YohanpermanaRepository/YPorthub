import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Briefcase, 
    Plus, 
    Trash, 
    Upload, 
    X, 
    Calendar, 
    Loader2, 
    Check,
    Search,
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
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [sortField, setSortField] = useState<'position' | 'company' | 'startDate'>('startDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingData, setEditingData] = useState<Partial<Experience>>({});
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

    const startEdit = (exp: Experience) => {
        setEditingId(exp.id);
        setEditingData({ ...exp });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingData({});
    };

    const saveEdit = async () => {
        if (!editingId || !editingData.position?.trim() || !editingData.company?.trim()) {
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
            const payload: any = { ...editingData };
            payload.relatedCertificationId = payload.certificationId ?? null;
            delete payload.certificationId;

            const response = await fetch(`${API_BASE_URL}/experience/${editingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(errData || 'Failed to update experience');
            }
            
            await fetchData();
            setEditingId(null);
            setEditingData({});
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Delete this experience?")) return;

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/experience/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete experience');
            setExperiences(prev => prev.filter(e => e.id !== id));
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
        if (selectedIds.size === paginatedExperiences.length && paginatedExperiences.length > 0) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(paginatedExperiences.map(e => e.id));
            setSelectedIds(allIds);
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Delete ${selectedIds.size} experience(s)?`)) return;

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        const idsToDelete = Array.from(selectedIds);
        
        try {
            await Promise.all(
                idsToDelete.map(id =>
                    fetch(`${API_BASE_URL}/experience/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                )
            );

            setExperiences(prev => prev.filter(e => !idsToDelete.includes(e.id)));
            setSelectedIds(new Set());
        } catch (err) {
            setError((err as Error).message);
        }
    };

    // Filter experiences based on search query
    const filteredExperiences = experiences.filter(exp =>
        exp.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatMonthYear(exp.startDate).toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort experiences
    const sortedExperiences = [...filteredExperiences].sort((a, b) => {
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
    const totalPages = Math.ceil(sortedExperiences.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedExperiences = sortedExperiences.slice(startIdx, endIdx);

    // Reset page if out of bounds
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [sortedExperiences.length, currentPage, totalPages]);

    return (
        <div className="bg-gray-800 p-4 rounded-2xl shadow-xl border border-gray-700">
            {/* Header */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5" />
                        Experience
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
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by position, company, or description..."
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
                                        checked={selectedIds.size > 0 && selectedIds.size === paginatedExperiences.length && paginatedExperiences.length > 0}
                                        onChange={toggleSelectAll}
                                        className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                    />
                                </th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold w-12">No.</th>
                                <th 
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('position');
                                        setSortOrder(sortField === 'position' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Position {sortField === 'position' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('company');
                                        setSortOrder(sortField === 'company' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Company {sortField === 'company' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold">Logo</th>
                                <th 
                                    className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('startDate');
                                        setSortOrder(sortField === 'startDate' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Duration {sortField === 'startDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-2 text-left text-gray-200 font-semibold">Description</th>
                                <th className="px-4 py-2 text-left text-gray-200 font-semibold">Certification</th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {paginatedExperiences.map((exp, index) => (
                                <tr key={exp.id} className="hover:bg-gray-700/50 transition">
                                    <td className="px-4 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(exp.id)}
                                            onChange={() => toggleSelect(exp.id)}
                                            className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center text-gray-400 font-medium w-12">
                                        {startIdx + index + 1}
                                    </td>
                                    {editingId === exp.id ? (
                                        <>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingData.position || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, position: e.target.value }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingData.company || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, company: e.target.value }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex items-center gap-1 justify-center">
                                                    {editingData.logo && (
                                                        <img src={editingData.logo} alt="logo" className="w-6 h-6 rounded" />
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={editingData.logo || ''}
                                                        onChange={(e) => setEditingData(prev => ({ ...prev, logo: e.target.value }))}
                                                        placeholder="URL"
                                                        className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <div className="flex gap-1">
                                                    <input
                                                        type="month"
                                                        value={normalizeToMonthInputValue(editingData.startDate || '')}
                                                        onChange={(e) => setEditingData(prev => ({ ...prev, startDate: e.target.value }))}
                                                        className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                    />
                                                    <span className="text-gray-500 px-1">—</span>
                                                    <input
                                                        type="month"
                                                        value={editingData.endDate === 'Present' ? '' : normalizeToMonthInputValue(editingData.endDate || '')}
                                                        onChange={(e) => setEditingData(prev => ({ ...prev, endDate: e.target.value }))}
                                                        disabled={editingData.endDate === 'Present'}
                                                        className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                                    />
                                                    <label className="flex items-center gap-1 text-xs text-gray-300">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingData.endDate === 'Present'}
                                                            onChange={(e) => setEditingData(prev => ({ ...prev, endDate: e.target.checked ? 'Present' : '' }))}
                                                            className="w-3 h-3"
                                                        />
                                                        <span className="whitespace-nowrap">Now</span>
                                                    </label>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <textarea
                                                    value={editingData.description || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, description: e.target.value }))}
                                                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs min-h-[100px] min-w-[400px]"
                                                    placeholder="Description..."
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <select
                                                    value={editingData.certificationId || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, certificationId: e.target.value ? parseInt(e.target.value) : undefined }))}
                                                    className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                >
                                                    <option value="">None</option>
                                                    {allCertifications.map(cert => (
                                                        <option key={cert.id} value={cert.id}>{cert.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => handleDelete(exp.id)}
                                                    className="text-red-400 hover:text-red-300 transition"
                                                    title="Delete"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-4 py-2 text-white font-medium cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(exp)}>
                                                {exp.position}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(exp)}>
                                                {exp.company}
                                            </td>
                                            <td className="px-4 py-2 text-center cursor-pointer" onClick={() => startEdit(exp)}>
                                                {exp.logo && (
                                                    <img src={exp.logo} alt={exp.company} className="w-6 h-6 rounded mx-auto" title={exp.company} />
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition text-xs" onClick={() => startEdit(exp)}>
                                                {formatMonthYear(exp.startDate)} — {formatMonthYear(exp.endDate)}
                                            </td>
                                            <td className="px-4 py-2 text-gray-400 cursor-pointer hover:bg-gray-600/50 text-xs line-clamp-2" onClick={() => startEdit(exp)}>
                                                {exp.description}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => startEdit(exp)}>
                                                {exp.certificationId ? (
                                                    allCertifications.find(c => c.id === exp.certificationId)?.name || '—'
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => handleDelete(exp.id)}
                                                    className="text-red-400 hover:text-red-300 transition"
                                                    title="Delete"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {sortedExperiences.length > 0 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                        <div className="text-sm text-gray-400">
                            Showing {startIdx + 1} to {Math.min(endIdx, sortedExperiences.length)} of {sortedExperiences.length} items
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

            {experiences.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                    No experiences yet. Add one to get started!
                </div>
            )}
        </div>
    );
};

export default ExperienceManager;