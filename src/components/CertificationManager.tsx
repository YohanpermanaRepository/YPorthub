import React, { useState, useEffect, useCallback } from 'react';
import type { Certification } from '../types';
import { API_BASE_URL } from '../config';
import { Loader2, Plus, Trash, Award, Check, X, Search } from "lucide-react";

// Dropdown Component untuk Category/Issuer dengan suggestions
type DropdownInputProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
};

const DropdownInput: React.FC<DropdownInputProps> = ({ value, onChange, suggestions, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const filtered = suggestions.length > 0 
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : [];

  // Show all suggestions if input is empty, otherwise show filtered
  const displayedSuggestions = value.trim() === '' ? suggestions : filtered;

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={placeholder}
        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
      />
      
      {isOpen && displayedSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-20 max-h-48 overflow-y-auto">
          {displayedSuggestions.map((item, idx) => (
            <button
              key={`${item}-${idx}`}
              type="button"
              onClick={() => {
                onChange(item);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-white text-sm hover:bg-gray-600 transition ${
                value === item ? 'bg-gray-600 font-semibold' : ''
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CertificationManager: React.FC = () => {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Partial<Certification>>({});
  const [newCert, setNewCert] = useState<Omit<Certification, 'id'> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [sortField, setSortField] = useState<'year' | 'name' | 'issuer' | 'category'>('year');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchCerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/certifications`);
      if (!response.ok) throw new Error('Failed to fetch certifications');
      setCertifications(await response.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  // Get unique categories and issuers for suggestions
  const uniqueCategories = Array.from(new Set(certifications.map(c => c.category).filter(Boolean))).sort();
  const uniqueIssuers = Array.from(new Set(certifications.map(c => c.issuer).filter(Boolean))).sort();

  const startEdit = (cert: Certification) => {
    setEditingId(cert.id);
    setEditingData({ ...cert });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    
    // Validate required fields
    if (!editingData.name?.trim() || !editingData.issuer?.trim() || !editingData.category?.trim()) {
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
      // Ensure all fields are included in request
      const payload: Certification = {
        id: editingId,
        name: editingData.name || '',
        issuer: editingData.issuer || '',
        category: editingData.category || '',
        year: editingData.year || new Date().getFullYear(),
        link: editingData.link || ''
      };

      const response = await fetch(`${API_BASE_URL}/certifications/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(errData || 'Failed to update certification');
      }
      
      await fetchCerts();
      setEditingId(null);
      setEditingData({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this certification?")) return;

    const token = localStorage.getItem('authToken');
    if (!token) return setError("Authentication error.");

    try {
      const response = await fetch(`${API_BASE_URL}/certifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete certification');
      setCertifications(prev => prev.filter(c => c.id !== id));
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
    if (selectedIds.size === paginatedCertifications.length && paginatedCertifications.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(paginatedCertifications.map(c => c.id));
      setSelectedIds(allIds);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} certification(s)?`)) return;

    const token = localStorage.getItem('authToken');
    if (!token) return setError("Authentication error.");

    const idsToDelete = Array.from(selectedIds);
    
    try {
      // Delete all selected items
      await Promise.all(
        idsToDelete.map(id =>
          fetch(`${API_BASE_URL}/certifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
        )
      );

      setCertifications(prev => prev.filter(c => !idsToDelete.includes(c.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Filter certifications based on search query
  const filteredCertifications = certifications.filter(cert =>
    cert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cert.year.toString().includes(searchQuery) ||
    cert.link.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort certifications
  const sortedCertifications = [...filteredCertifications].sort((a, b) => {
    let compareA: any = a[sortField];
    let compareB: any = b[sortField];

    // Handle string comparisons (case-insensitive)
    if (typeof compareA === 'string' && typeof compareB === 'string') {
      compareA = compareA.toLowerCase();
      compareB = compareB.toLowerCase();
    }

    if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
    if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedCertifications.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedCertifications = sortedCertifications.slice(startIdx, endIdx);

  // Reset page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [sortedCertifications.length, currentPage, totalPages]);

  const addNewCert = async () => {
    if (!newCert || !newCert.name?.trim() || !newCert.issuer?.trim() || !newCert.category?.trim()) {
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
      const payload = {
        name: newCert.name.trim(),
        issuer: newCert.issuer.trim(),
        category: newCert.category.trim(),
        year: newCert.year,
        link: newCert.link.trim()
      };

      const response = await fetch(`${API_BASE_URL}/certifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(errData || 'Failed to create certification');
      }
      
      await fetchCerts();
      setNewCert(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
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
            <Award className="w-5 h-5" />
            Certifications
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
                  Save Changes
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
              onClick={() => setNewCert({ category: '', name: '', issuer: '', year: new Date().getFullYear(), link: '' })}
              disabled={newCert !== null || editingId !== null}
              className="flex items-center gap-1 bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold py-1 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
            placeholder="Search certifications..."
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
        <div className="bg-red-500/10 border border-red-500/40 text-red-200 p-3 rounded-lg mb-4 text-sm">
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
                    checked={selectedIds.size > 0 && selectedIds.size === paginatedCertifications.length && paginatedCertifications.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 text-center text-gray-200 font-semibold w-12">No.</th>
                <th 
                  className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                  onClick={() => {
                    setSortField('name');
                    setSortOrder(sortField === 'name' && sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                  onClick={() => {
                    setSortField('issuer');
                    setSortOrder(sortField === 'issuer' && sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Issuer {sortField === 'issuer' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-2 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                  onClick={() => {
                    setSortField('category');
                    setSortOrder(sortField === 'category' && sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Category {sortField === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-2 text-center text-gray-200 font-semibold min-w-24 cursor-pointer hover:bg-gray-600/50 transition"
                  onClick={() => {
                    setSortField('year');
                    setSortOrder(sortField === 'year' && sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Year {sortField === 'year' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-2 text-left text-gray-200 font-semibold">Link</th>
                <th className="px-4 py-2 text-center text-gray-200 font-semibold w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {/* Existing Certifications */}
              {paginatedCertifications.map((cert, index) => (
                <tr key={cert.id} className="hover:bg-gray-700/50 transition">
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(cert.id)}
                      onChange={() => toggleSelect(cert.id)}
                      className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-center text-gray-400 font-medium w-12">
                    {startIdx + index + 1}
                  </td>
                  {editingId === cert.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editingData.name || ''}
                          onChange={(e) => setEditingData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <DropdownInput
                          value={editingData.issuer || ''}
                          onChange={(val) => setEditingData(prev => ({ ...prev, issuer: val }))}
                          suggestions={uniqueIssuers}
                          placeholder="Select issuer..."
                        />
                      </td>
                      <td className="px-4 py-2">
                        <DropdownInput
                          value={editingData.category || ''}
                          onChange={(val) => setEditingData(prev => ({ ...prev, category: val }))}
                          suggestions={uniqueCategories}
                          placeholder="Select category..."
                        />
                      </td>
                      <td className="px-4 py-2 min-w-24">
                        <input
                          type="number"
                          value={editingData.year || new Date().getFullYear()}
                          onChange={(e) => setEditingData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                          className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500 text-center font-medium"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editingData.link || ''}
                          onChange={(e) => setEditingData(prev => ({ ...prev, link: e.target.value }))}
                          className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                          title={editingData.link || 'No link'}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleDelete(cert.id)}
                          className="text-red-400 hover:text-red-300 transition"
                          title="Delete"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 text-white font-medium cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(cert)}>
                        {cert.name}
                      </td>
                      <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(cert)}>
                        {cert.issuer}
                      </td>
                      <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(cert)}>
                        {cert.category}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => startEdit(cert)}>
                        {cert.year}
                      </td>
                      <td className="px-4 py-2 text-gray-400 cursor-pointer hover:bg-gray-600/50" onClick={() => startEdit(cert)}>
                        {cert.link ? (
                        <a
                        href={cert.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-none truncate block"
                        onClick={(e) => e.stopPropagation()}
                        title={cert.link}
                      >
                        Link
                      </a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleDelete(cert.id)}
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

            {/* New Certification Row */}
            {newCert && (
              <tr className="bg-gray-700/50 border-t-2 border-green-500">
                <td className="px-4 py-2 text-center">
                  {/* Checkbox disabled for new rows */}
                </td>
                <td className="px-4 py-2 text-center text-gray-400 font-medium w-12">
                  New
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="Cert name"
                    value={newCert.name}
                    onChange={(e) => setNewCert(prev => ({ ...prev!, name: e.target.value }))}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </td>
                <td className="px-4 py-2">
                  <DropdownInput
                    value={newCert.issuer}
                    onChange={(val) => setNewCert(prev => ({ ...prev!, issuer: val }))}
                    suggestions={uniqueIssuers}
                    placeholder="Select issuer..."
                  />
                </td>
                <td className="px-4 py-2">
                  <DropdownInput
                    value={newCert.category}
                    onChange={(val) => setNewCert(prev => ({ ...prev!, category: val }))}
                    suggestions={uniqueCategories}
                    placeholder="Select category..."
                  />
                </td>
                <td className="px-4 py-2 min-w-24">
                  <input
                    type="number"
                    value={newCert.year}
                    onChange={(e) => setNewCert(prev => ({ ...prev!, year: parseInt(e.target.value) }))}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500 text-center font-medium"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="URL"
                    value={newCert.link}
                    onChange={(e) => setNewCert(prev => ({ ...prev!, link: e.target.value }))}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                    title={newCert.link || 'No link yet'}
                  />
                </td>
                <td className="px-4 py-2 text-center flex gap-1 justify-center">
                  <button
                    onClick={addNewCert}
                    disabled={isSaving}
                    className="text-green-400 hover:text-green-300 disabled:opacity-50"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setNewCert(null)}
                    disabled={isSaving}
                    className="text-gray-400 hover:text-gray-300 disabled:opacity-50"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination Controls */}
        {sortedCertifications.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-sm text-gray-400">
              Showing {startIdx + 1} to {Math.min(endIdx, sortedCertifications.length)} of {sortedCertifications.length} items
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

      {certifications.length === 0 && !newCert && (
        <div className="text-center py-8 text-gray-400">
          No certifications yet. Click "Add" to create one!
        </div>
      )}
    </div>
  );
};

export default CertificationManager;