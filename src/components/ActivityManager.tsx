import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Activity } from '../types';
import { API_BASE_URL } from '../config';
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  Loader2,
  ImagePlus,
  Calendar,
  Search,
} from 'lucide-react';

type ActivityFormState = {
  title: string;
  description: string;
  images: string[];
};

const initialFormData: ActivityFormState = {
  title: '',
  description: '',
  images: [],
};

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function toDatetimeLocalValue(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  // datetime-local expects `YYYY-MM-DDTHH:mm` in local time
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ActivityManager: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // State for image preview modal (same concept as ProjectManager)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);

  // IMPORTANT: untuk update, backend harus mempertahankan gambar lama
  // kalau frontend "tidak mengirim field gambar apa pun".
  const [imagesDirty, setImagesDirty] = useState(false);

  const [formData, setFormData] = useState<ActivityFormState>(initialFormData);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createdAtMode, setCreatedAtMode] = useState<'now' | 'manual'>('now');
  const [createdAtInput, setCreatedAtInput] = useState('');

  const normalizeActivity = (a: any): Activity => {
    const images = Array.isArray(a.images) ? a.images.filter(Boolean) : [];
    const imageUrl = a.imageUrl || images[0];
    return {
      id: Number(a.id),
      title: String(a.title ?? ''),
      description: String(a.description ?? ''),
      imageUrl: imageUrl ? String(imageUrl) : undefined,
      images,
      createdAt: String(a.createdAt ?? ''),
    };
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/activity`);
      if (!res.ok) throw new Error('Failed to fetch activities');
      const data = await res.json();
      const list: Activity[] = Array.isArray(data) ? data.map(normalizeActivity) : [];
      setActivities(list);
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
    if (!isImagePreviewOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeImagePreview();
      if (e.key === 'ArrowLeft') goPrevImage();
      if (e.key === 'ArrowRight') goNextImage();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImagePreviewOpen, imagePreviewUrls.length]);

  const openForm = (activity: Activity | null = null) => {
    setError(null);
    setSuccess(null);
    setImageUrlInput('');
    setEditingActivity(activity);
    setIsFormOpen(true);
    if (activity) {
      setFormData({
        title: activity.title ?? '',
        description: activity.description ?? '',
        images:
          activity.images?.length
            ? activity.images
            : activity.imageUrl
              ? [activity.imageUrl]
              : [],
      });
      setImagesDirty(false);
      setCreatedAtMode('manual');
      setCreatedAtInput(toDatetimeLocalValue(activity.createdAt));
    } else {
      setFormData(initialFormData);
      setImagesDirty(false);
      setCreatedAtMode('now');
      setCreatedAtInput('');
    }
  };

  const closeForm = ({ keepSuccess = false }: { keepSuccess?: boolean } = {}) => {
    setIsFormOpen(false);
    setEditingActivity(null);
    setError(null);
    if (!keepSuccess) setSuccess(null);
    setImageUrlInput('');
    setFormData(initialFormData);
    setImagesDirty(false);
    setCreatedAtMode('now');
    setCreatedAtInput('');
  };

  const openImagePreview = (urls: string[], index: number) => {
    const cleaned = urls.map((u) => u.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    const safeIndex = Math.min(Math.max(index, 0), cleaned.length - 1);
    setImagePreviewUrls(cleaned);
    setImagePreviewIndex(safeIndex);
    setIsImagePreviewOpen(true);
  };

  const closeImagePreview = () => {
    setIsImagePreviewOpen(false);
    setImagePreviewUrls([]);
    setImagePreviewIndex(0);
  };

  const goPrevImage = () => {
    setImagePreviewIndex((prev) => {
      const len = imagePreviewUrls.length;
      if (len <= 1) return prev;
      return (prev - 1 + len) % len;
    });
  };

  const goNextImage = () => {
    setImagePreviewIndex((prev) => {
      const len = imagePreviewUrls.length;
      if (len <= 1) return prev;
      return (prev + 1) % len;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (formData.images.length >= 10) {
      setError('Max 10 images for one activity.');
      return;
    }
    setFormData((prev) => ({ ...prev, images: [...prev.images, url] }));
    setImagesDirty(true);
    setImageUrlInput('');
  };

  const removeImageAt = (indexToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, index) => index !== indexToRemove),
    }));
    setImagesDirty(true);
  };

  const uploadFileAndGetUrl = async (file: File) => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Authentication error.');

    const uploadFormData = new FormData();
    uploadFormData.append('image', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadFormData,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Upload failed');
    return data.url as string;
  };

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = 10 - formData.images.length;
    if (remaining <= 0) {
      setError('Max 10 images for one activity.');
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remaining);
    if (selectedFiles.length === 0) return;

    setError(null);
    setImagesDirty(true);
    setIsUploadingImages(true);
    try {
      const newUrls: string[] = [];
      for (const file of selectedFiles) {
        const url = await uploadFileAndGetUrl(file);
        newUrls.push(url);
      }
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...newUrls] }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Authentication error.');

      if (createdAtMode === 'manual' && !createdAtInput) {
        throw new Error('Please pick date & time for Created At (Manual).');
      }

      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
      };

      const desc = formData.description.trim();
      if (desc) payload.description = desc;

      if (imagesDirty) {
        const imagesClean = formData.images.map((i) => i.trim()).filter(Boolean);
        payload.images = imagesClean;
      }

      // createdAt setting (create & update)
      if (createdAtMode === 'now') {
        payload.createdAt = new Date().toISOString();
      } else if (createdAtMode === 'manual' && createdAtInput) {
        const dt = new Date(createdAtInput);
        if (!Number.isNaN(dt.getTime())) {
          payload.createdAt = dt.toISOString();
        }
      }

      const method = editingActivity ? 'PUT' : 'POST';
      const url = editingActivity
        ? `${API_BASE_URL}/activity/${editingActivity.id}`
        : `${API_BASE_URL}/activity`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `Failed to ${editingActivity ? 'update' : 'create'} activity`);
      }

      await fetchData();
      setSuccess('Activity saved successfully!');
      closeForm({ keepSuccess: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure?')) return;
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Authentication error.');

      const response = await fetch(`${API_BASE_URL}/activity/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || 'Failed to delete activity');
      }

      setActivities((prev) => prev.filter((a) => a.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  const filteredActivities = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activities;

    return activities.filter((a) => {
      const haystack = [
        a.title,
        a.description,
        a.createdAt,
        a.imageUrl ?? '',
        ...(a.images || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  })();

  // Pagination calculations
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedActivities = filteredActivities.slice(startIdx, endIdx);

  // Reset page if out of bounds (e.g. after search/delete)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages, filteredActivities.length]);

  // When search changes, go back to page 1 for usability
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const toggleSelectAll = () => {
    const idsOnPage = paginatedActivities.map((a) => a.id);
    if (idsOnPage.length === 0) return;

    const allSelectedOnPage = idsOnPage.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        idsOnPage.forEach((id) => next.delete(id));
      } else {
        idsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} activitiy(s)?`)) return;

    const idsToDelete = Array.from(selectedIds);
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('Authentication error.');
      return;
    }

    setIsBulkDeleting(true);
    setError(null);
    try {
      await Promise.all(
        idsToDelete.map((id) =>
          fetch(`${API_BASE_URL}/activity/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => null);
              throw new Error(errData?.message || `Failed to delete activity ${id}`);
            }
          })
        )
      );

      setActivities((prev) => prev.filter((a) => !idsToDelete.includes(a.id)));
      if (editingActivity && idsToDelete.includes(editingActivity.id)) {
        closeForm();
      }
      setSelectedIds(new Set());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-navy-400" size={24} />
            Activity Manager
          </h2>
          <p className="text-gray-400 text-sm">Manage your activities and images</p>
        </div>
        <div className="flex gap-2 items-center">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => void deleteSelected()}
              disabled={isBulkDeleting}
              className="flex items-center justify-center gap-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-2 px-3 rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} />
              Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => openForm()}
            className="flex items-center justify-center gap-1 bg-navy-600 hover:bg-navy-500 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg active:scale-95 text-sm"
          >
            <Plus size={20} />
            Add Activity
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search activities..."
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

      {error && (
        <div className="mb-3 bg-red-500/10 border border-red-500/50 rounded-lg p-2 flex items-center gap-2 text-red-200">
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">
            <X size={18} />
          </button>
        </div>
      )}

      {activities.length === 0 && !error ? (
        <div className="text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
          <ImagePlus className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400 italic">No activities yet.</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/30 border border-dashed border-gray-700 rounded-2xl">
          <ImagePlus className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400 italic">No activities match your search.</p>
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
                        paginatedActivities.length > 0 &&
                        paginatedActivities.every((a) => selectedIds.has(a.id))
                      }
                      onChange={toggleSelectAll}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                    />
                  </th>
                  <th className="px-4 py-2 text-center text-gray-200 font-semibold w-14">No.</th>
                  <th className="px-4 py-2 text-left text-gray-200 font-semibold">Title</th>
                  <th className="px-4 py-2 text-left text-gray-200 font-semibold w-40">Created At</th>
                  <th className="px-4 py-2 text-left text-gray-200 font-semibold">Description</th>
                  <th className="px-4 py-2 text-left text-gray-200 font-semibold w-28">Images</th>
                  <th className="px-4 py-2 text-center text-gray-200 font-semibold w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {paginatedActivities.map((a, index) => {
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-gray-700/50 transition cursor-pointer"
                      onClick={() => openForm(a)}
                    >
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(a.id)}
                          className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-center text-gray-400 font-medium">
                        {startIdx + index + 1}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-white font-semibold hover:text-navy-400 transition-colors truncate block">
                          {a.title}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-300 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Calendar size={14} className="text-navy-400" />
                          <span>{formatDate(a.createdAt) || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {a.description ? (
                          <span className="line-clamp-2">{a.description}</span>
                        ) : (
                          <span className="text-gray-500 italic">No description</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-gray-300 text-sm">
                          {a.images?.length ? `${a.images.length} images` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openForm(a);
                            }}
                            className="p-2 bg-gray-700 hover:bg-navy-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(a.id);
                            }}
                            className="p-2 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredActivities.length > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="text-sm text-gray-400">
                Showing {startIdx + 1} to {Math.min(endIdx, filteredActivities.length)} of {filteredActivities.length} items
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
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 p-4 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {editingActivity ? <Pencil className="text-navy-400" size={18} /> : <Plus className="text-navy-400" size={18} />}
                {editingActivity ? 'Edit' : 'Add'} Activity
              </h3>
              <button onClick={() => closeForm()} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Title</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Leadership Workshop"
                  required
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Optional description"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-navy-500 outline-none transition min-h-[110px]"
                  rows={4}
                />
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-300">Created At</label>
                  <span className="text-xs text-gray-400">2 options</span>
                </div>
                <p className="text-xs text-amber-300 mb-3">
                  Dibuat dan tersimpan di backend sebagai `createdAt` saat mode Manual/Now dipilih.
                </p>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setCreatedAtMode('now')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      createdAtMode === 'now'
                        ? 'bg-navy-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedAtMode('manual');
                      if (!createdAtInput) {
                        const fallback = editingActivity?.createdAt ?? new Date().toISOString();
                        setCreatedAtInput(toDatetimeLocalValue(String(fallback)));
                      }
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      createdAtMode === 'manual'
                        ? 'bg-navy-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    Manual
                  </button>
                </div>

                {createdAtMode === 'manual' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Pick date & time
                    </label>
                    <input
                      type="datetime-local"
                      value={createdAtInput}
                      onChange={(e) => setCreatedAtInput(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition"
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-300">Images</label>
                  <p className="text-xs text-gray-400">{formData.images.length}/10</p>
                </div>

                {formData.images.length ? (
                  <div className="space-y-2 mb-3">
                    {formData.images.map((img, idx) => {
                      const url = String(img || '').trim();
                      return (
                        <div
                          key={`${img}-${idx}`}
                          className="flex items-center gap-2 bg-gray-700/40 border border-gray-600 rounded-lg px-2 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-200 truncate" title={url || '—'}>
                              {url || '—'}
                            </div>
                          </div>

                          {editingActivity && url ? (
                            <button
                              type="button"
                              onClick={() => openImagePreview(formData.images, idx)}
                              className="px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold"
                              title="Preview"
                            >
                              Preview
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => removeImageAt(idx)}
                            className="px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs font-semibold"
                            title="Remove image"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm italic mb-3">No images selected.</div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Paste image URL"
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition text-sm"
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50"
                      disabled={!imageUrlInput.trim() || formData.images.length >= 10}
                    >
                      + Add
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      ref={fileInputRef}
                      onChange={(e) => handleUploadImages(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm disabled:opacity-50"
                      disabled={isUploadingImages || formData.images.length >= 10}
                    >
                      {isUploadingImages ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      Upload Images
                    </button>
                    <p className="text-xs text-gray-400 whitespace-nowrap">
                      {imagesDirty ? 'Will replace on save' : 'Will keep existing on save'}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-2 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => closeForm()}
                  className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (createdAtMode === 'manual' && !createdAtInput)}
                  className="flex-[2] py-2 px-4 bg-navy-600 hover:bg-navy-500 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 text-sm disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                  {editingActivity ? 'Update Activity' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImagePreviewOpen && imagePreviewUrls.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[110] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-gray-800 p-4 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">Image Preview</h3>
              <button
                type="button"
                onClick={closeImagePreview}
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/30 rounded-lg overflow-hidden border border-gray-700 relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                <button
                  type="button"
                  onClick={goPrevImage}
                  className="p-2 rounded-full bg-gray-900/60 hover:bg-gray-900/80 text-white disabled:opacity-50"
                  title="Previous"
                  aria-label="Previous image"
                  disabled={imagePreviewUrls.length <= 1}
                >
                  ←
                </button>
              </div>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <button
                  type="button"
                  onClick={goNextImage}
                  className="p-2 rounded-full bg-gray-900/60 hover:bg-gray-900/80 text-white disabled:opacity-50"
                  title="Next"
                  aria-label="Next image"
                  disabled={imagePreviewUrls.length <= 1}
                >
                  →
                </button>
              </div>

              <img
                src={imagePreviewUrls[imagePreviewIndex]}
                alt="Preview"
                className="w-full max-h-[70vh] object-contain mx-auto"
                onError={() => goNextImage()}
              />
            </div>

            <div className="mt-2 text-sm text-gray-400 flex items-center justify-between">
              <span>
                {imagePreviewIndex + 1} / {imagePreviewUrls.length}
              </span>
              <span className="text-gray-500">Tip: gunakan tombol panah kiri/kanan</span>
            </div>
          </div>
        </div>
      )}

      {/* Keep success minimal: closeForm langsung menutup modal sehingga ini biasanya tidak terlihat */}
      {success ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-500/10 border border-green-500/50 text-green-200 rounded-lg px-4 py-2 text-sm shadow-lg">
          {success}
        </div>
      ) : null}
    </div>
  );
};

export default ActivityManager;

