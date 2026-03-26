import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    Plus,
    Trash2,
    X,
    Loader2,
    AlertCircle,
    Code2,
    Search
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
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingData, setEditingData] = useState<Partial<Technology>>({});
    const [newTech, setNewTech] = useState<Omit<Technology, 'id'> | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);

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

    const startEdit = (tech: Technology) => {
        setEditingId(tech.id);
        setEditingData({ ...tech, icon: tech.icon ?? '' });
        setError(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingData({});
        setError(null);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        if (!editingData.name?.trim()) {
            setError("Please fill in technology name");
            return;
        }

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setIsSaving(true);
        setError(null);
        try {
            const payload: Technology = {
                id: editingId,
                name: String(editingData.name || '').trim(),
                icon: editingData.icon ? String(editingData.icon).trim() : null,
            };

            const response = await fetch(`${API_BASE_URL}/technologies/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || 'Failed to update technology');
            }

            await fetchTechnologies();
            setEditingId(null);
            setEditingData({});
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const addNewTech = async () => {
        if (!newTech || !newTech.name?.trim()) {
            setError("Please fill in technology name");
            return;
        }

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                name: newTech.name.trim(),
                icon: newTech.icon ? newTech.icon.trim() : null,
            };

            const response = await fetch(`${API_BASE_URL}/technologies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || 'Failed to create technology');
            }

            await fetchTechnologies();
            setNewTech(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
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
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            if (editingId === id) {
                setEditingId(null);
                setEditingData({});
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const idsOnPage = paginatedTechnologies.map(t => t.id);
        if (idsOnPage.length === 0) return;

        const allSelectedOnPage = idsOnPage.every(id => selectedIds.has(id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelectedOnPage) {
                idsOnPage.forEach(id => next.delete(id));
            } else {
                idsOnPage.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        const idsToDelete = Array.from(selectedIds);

        if (!window.confirm(`Delete ${idsToDelete.length} technologies?`)) return;

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setIsSaving(true);
        setError(null);
        try {
            await Promise.all(
                idsToDelete.map(id =>
                    fetch(`${API_BASE_URL}/technologies/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` },
                    }).then(async (res) => {
                        if (!res.ok) {
                            const errData = await res.json().catch(() => null);
                            throw new Error(errData?.message || `Failed to delete technology ${id}`);
                        }
                    })
                )
            );

            await fetchTechnologies();
            setSelectedIds(new Set());
            if (editingId && idsToDelete.includes(editingId)) {
                setEditingId(null);
                setEditingData({});
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredTechnologies = (() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return technologies;
        return technologies.filter(t => {
            const haystack = `${t.name ?? ''} ${t.icon ?? ''}`.toLowerCase();
            return haystack.includes(q);
        });
    })();

    const totalPages = Math.ceil(filteredTechnologies.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedTechnologies = filteredTechnologies.slice(startIdx, endIdx);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages, filteredTechnologies.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

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
                <div className="flex gap-2">
                    {editingId !== null && (
                        <>
                            <button
                                onClick={saveEdit}
                                disabled={isSaving}
                                className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="flex items-center gap-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                    {selectedIds.size > 0 && (
                        <button
                            type="button"
                            onClick={() => void deleteSelected()}
                            disabled={isSaving}
                            className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-2 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 size={16} />
                            Delete ({selectedIds.size})
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setError(null);
                            setNewTech({ name: '', icon: '' });
                        }}
                        disabled={newTech !== null || editingId !== null}
                        className="flex items-center justify-center gap-1 bg-navy-600 hover:bg-navy-500 text-white font-semibold py-2 px-3 rounded-lg transition-all shadow-lg active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={20} />
                        Add Technology
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search technologies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-9 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                />
                {searchQuery.trim() && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
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
                <>
                    {technologies.length === 0 ? (
                        <div className="text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
                            <Zap className="mx-auto text-gray-600 mb-4" size={48} />
                            <p className="text-gray-400 italic">No technologies found. Add one to get started!</p>
                        </div>
                    ) : filteredTechnologies.length === 0 ? (
                        <div className="text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
                            <Zap className="mx-auto text-gray-600 mb-4" size={48} />
                            <p className="text-gray-400 italic">No technologies match your search.</p>
                            {searchQuery.trim() ? (
                                <p className="text-xs text-gray-500 mt-2">Query: &quot;{searchQuery.trim()}&quot;</p>
                            ) : null}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-700 border-b border-gray-600 z-10">
                                        <tr>
                                            <th className="px-4 py-2 text-center text-gray-200 font-semibold w-14">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        paginatedTechnologies.length > 0 &&
                                                        paginatedTechnologies.every(t => selectedIds.has(t.id))
                                                    }
                                                    onChange={toggleSelectAll}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                                />
                                            </th>
                                            <th className="px-4 py-2 text-center text-gray-200 font-semibold w-14">No.</th>
                                            <th className="px-4 py-2 text-left text-gray-200 font-semibold">Name</th>
                                            <th className="px-4 py-2 text-left text-gray-200 font-semibold w-24">Icon</th>
                                            <th className="px-4 py-2 text-left text-gray-200 font-semibold">Icon Link</th>
                                            <th className="px-4 py-2 text-center text-gray-200 font-semibold w-28">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {paginatedTechnologies.map((tech, index) => {
                                            const isEditing = editingId === tech.id;
                                            const iconUrl = String((isEditing ? editingData.icon : tech.icon) ?? '').trim();
                                            return (
                                                <tr key={tech.id} className="hover:bg-gray-700/50 transition">
                                                    <td className="px-4 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(tech.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={() => toggleSelect(tech.id)}
                                                            className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-gray-400 font-medium">
                                                        {startIdx + index + 1}
                                                    </td>

                                                    {/* Name */}
                                                    <td
                                                        className={`px-4 py-2 ${isEditing ? '' : 'cursor-pointer hover:bg-gray-600/40'}`}
                                                        onClick={() => { if (!isEditing) startEdit(tech); }}
                                                    >
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                value={String(editingData.name ?? '')}
                                                                onChange={(e) => setEditingData(prev => ({ ...prev, name: e.target.value }))}
                                                                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                                placeholder="Technology name"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <span className="text-white font-medium">{tech.name}</span>
                                                        )}
                                                    </td>

                                                    {/* Icon preview */}
                                                    <td
                                                        className={`px-4 py-2 ${isEditing ? '' : 'cursor-pointer hover:bg-gray-600/40'}`}
                                                        onClick={() => { if (!isEditing) startEdit(tech); }}
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center overflow-hidden">
                                                            {iconUrl ? (
                                                                <img
                                                                    src={iconUrl}
                                                                    alt={tech.name}
                                                                    className="w-full h-full object-contain p-1"
                                                                    onError={(e) => {
                                                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Code2 className="text-gray-500" size={18} />
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Icon link */}
                                                    <td
                                                        className={`px-4 py-2 ${isEditing ? '' : 'cursor-pointer hover:bg-gray-600/40'}`}
                                                        onClick={() => { if (!isEditing) startEdit(tech); }}
                                                    >
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                value={String(editingData.icon ?? '')}
                                                                onChange={(e) => setEditingData(prev => ({ ...prev, icon: e.target.value }))}
                                                                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                                placeholder="https://..."
                                                                title={String(editingData.icon ?? '')}
                                                            />
                                                        ) : tech.icon ? (
                                                            <a
                                                                href={tech.icon}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-400 hover:text-blue-300 transition-none truncate block max-w-[520px]"
                                                                onClick={(e) => e.stopPropagation()}
                                                                title={tech.icon}
                                                            >
                                                                {tech.icon}
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-500">—</span>
                                                        )}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void handleDelete(tech.id);
                                                                }}
                                                                className="p-2 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* New row */}
                                        {newTech && (
                                            <tr className="bg-gray-700/50 border-t-2 border-green-500">
                                                <td className="px-4 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={false}
                                                        disabled
                                                        className="cursor-not-allowed w-4 h-4 rounded border border-gray-500 bg-gray-600 opacity-50 focus:outline-none"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center text-gray-400 font-medium">New</td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        value={newTech.name}
                                                        onChange={(e) => setNewTech(prev => ({ ...(prev as any), name: e.target.value }))}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                        placeholder="Technology name"
                                                        autoFocus
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="w-10 h-10 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center overflow-hidden">
                                                        {newTech.icon?.trim() ? (
                                                            <img
                                                                src={newTech.icon.trim()}
                                                                alt={newTech.name}
                                                                className="w-full h-full object-contain p-1"
                                                                onError={(e) => {
                                                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <Code2 className="text-gray-500" size={18} />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        value={newTech.icon ?? ''}
                                                        onChange={(e) => setNewTech(prev => ({ ...(prev as any), icon: e.target.value }))}
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                        placeholder="https://..."
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => void addNewTech()}
                                                            disabled={isSaving}
                                                            className="px-2 py-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white disabled:opacity-50 text-sm"
                                                            title="Save"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewTech(null)}
                                                            disabled={isSaving}
                                                            className="px-2 py-1 rounded-md bg-gray-600 hover:bg-gray-500 text-white disabled:opacity-50 text-sm"
                                                            title="Cancel"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {filteredTechnologies.length > 0 && (
                                <div className="flex items-center justify-between mt-4 px-2">
                                    <div className="text-sm text-gray-400">
                                        Showing {startIdx + 1} to {Math.min(endIdx, filteredTechnologies.length)} of {filteredTechnologies.length} items
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
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`px-3 py-1 rounded text-sm font-medium transition ${currentPage === page
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
                    )}
                </>
            )}
        </div>
    );
};

export default TechnologyManager;
