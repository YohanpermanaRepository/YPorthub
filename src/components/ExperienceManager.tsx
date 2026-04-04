import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Briefcase, Trash, X, Check, Search, AlertCircle, Upload, Loader2 } from 'lucide-react';
import type { Experience, Certification, Project } from '../types';
import { API_BASE_URL } from '../config';

function normalizeExperience(input: any): Experience {
    const id = Number(input?.id);

    return {
        id,
        company: String(input?.company ?? ''),
        position: String(input?.position ?? ''),
        logo: input?.logo ?? null,
        description: input?.description ?? null,
        startDate: input?.startDate ?? null,
        endDate: input?.endDate ?? null,
        certifications: Array.isArray(input?.certifications)
            ? input.certifications.map((c: any) => ({
                experienceId: Number(c?.experienceId ?? id),
                certificationId: Number(c?.certificationId ?? c?.certification?.id),
                certification: c?.certification,
            }))
            : [],
        images: Array.isArray(input?.images)
            ? input.images.map((img: any) => ({
                id: Number(img?.id),
                imageUrl: String(img?.imageUrl ?? ''),
                caption: img?.caption ?? null,
            }))
            : [],
        projects: Array.isArray(input?.projects)
            ? input.projects.map((p: any) => ({
                experienceId: Number(p?.experienceId ?? id),
                projectId: Number(p?.projectId ?? p?.project?.id),
                project: p?.project,
            }))
            : [],
    };
}

// Helper: Ubah format tanggal API ke format input month (YYYY-MM)
function normalizeToMonthInputValue(value: string | null | undefined): string {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'present') return '';

    // Already month input
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;

    // Common format from backend: "February 2025"
    const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (monthYearMatch) {
        const monthStr = monthYearMatch[1];
        const year = Number(monthYearMatch[2]);
        const parsed = new Date(`${monthStr} 1, ${year}`);
        if (!Number.isNaN(parsed.getTime())) {
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            return `${parsed.getFullYear()}-${m}`;
        }
    }

    // Fallback (best effort)
    const parsed = new Date(`${trimmed} 01`);
    if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }

    return '';
}

function monthInputToMonthYear(value: string): string {
    if (!/^\d{4}-\d{2}$/.test(value)) return value;
    const [yStr, mStr] = value.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = new Date(y, (m || 1) - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Helper: Format tampilan tanggal (mis. "Feb 2025" atau biarkan apa adanya kalau bukan YYYY-MM)
function formatMonthYear(value: string | null | undefined): string {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'present') return 'Present';

    if (/^\d{4}-\d{2}$/.test(trimmed)) {
        const [y, m] = trimmed.split('-').map(Number);
        const d = new Date(y, (m || 1) - 1, 1);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        }
    }

    return trimmed;
}

function normalizeDateForApi(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === 'present') return 'Present';
    if (/^\d{4}-\d{2}$/.test(trimmed)) return monthInputToMonthYear(trimmed);
    return trimmed; // assume already "February 2025"
}

const ExperienceManager: React.FC = () => {
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [allCertifications, setAllCertifications] = useState<Certification[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
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
    const [isCreating, setIsCreating] = useState(false);
    const [editingData, setEditingData] = useState<Partial<Experience>>({});

    // Editing relasi
    const [editingCertificationIds, setEditingCertificationIds] = useState<Set<number>>(new Set());
    const [editingProjectIds, setEditingProjectIds] = useState<Set<number>>(new Set());
    const [editingImages, setEditingImages] = useState<Array<{ id?: number; imageUrl: string; caption: string }>>([]);
    const [originalCertificationIds, setOriginalCertificationIds] = useState<Set<number>>(new Set());
    const [originalProjectIds, setOriginalProjectIds] = useState<Set<number>>(new Set());
    const [originalImagesSnapshot, setOriginalImagesSnapshot] = useState<Array<{ id?: number; imageUrl: string; caption: string }>>([]);
    const [isEditingDetailLoading, setIsEditingDetailLoading] = useState(false);
    const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Summary counts untuk kolom tabel (fetch hanya untuk item di current page).
    const countsCacheRef = useRef<Map<number, {
        certCount: number;
        certNames: string[];
        projectCount: number;
        imageCount: number;
    }>>(new Map());
    const [countsById, setCountsById] = useState<Record<number, {
        certCount: number;
        certNames: string[];
        projectCount: number;
        imageCount: number;
    }>>({});
    const [isPageCountsLoading, setIsPageCountsLoading] = useState(false);

    const handleUploadExperienceImage = async (file: File, index: number) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication error.");
            return;
        }

        setUploadingImageIndex(index);
        setError(null);

        const uploadFormData = new FormData();
        uploadFormData.append('image', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: uploadFormData,
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.message || 'Upload failed');
            }

            const url = data?.url;
            if (!url) throw new Error('Upload did not return image url');

            setEditingImages(prev =>
                prev.map((it, i) => (i === index ? { ...it, imageUrl: url } : it))
            );
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploadingImageIndex(null);
        }
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [expResponse, certResponse, projectResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/experience`),
                fetch(`${API_BASE_URL}/certifications`),
                fetch(`${API_BASE_URL}/projects`),
            ]);
            if (!expResponse.ok || !certResponse.ok || !projectResponse.ok) throw new Error('Failed to fetch data');

            const [expJson, certJson, projectJson] = await Promise.all([
                expResponse.json(),
                certResponse.json(),
                projectResponse.json(),
            ]);

            const expList = Array.isArray(expJson)
                ? expJson
                : Array.isArray(expJson?.value)
                    ? expJson.value
                    : [];
            const certList = Array.isArray(certJson)
                ? certJson
                : Array.isArray(certJson?.value)
                    ? certJson.value
                    : [];
            const projectList = Array.isArray(projectJson)
                ? projectJson
                : Array.isArray(projectJson?.value)
                    ? projectJson.value
                    : [];

            setAllCertifications(certList);
            setAllProjects(projectList);

            // Jangan fetch detail untuk semua experience di awal (biar tidak berat).
            // Relasi certifications/images/projects akan diambil saat user klik edit.
            setExperiences(expList.map(normalizeExperience));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (fileInputRefs.current.length !== editingImages.length) {
        fileInputRefs.current.length = editingImages.length;
    }

    const startCreate = async () => {
        setIsCreating(true);
        setEditingId(null);
        setEditingData({
            company: '',
            position: '',
            logo: null,
            description: null,
            startDate: null,
            endDate: null,
        });
        setEditingCertificationIds(new Set());
        setEditingProjectIds(new Set());
        setEditingImages([]);
        setOriginalCertificationIds(new Set());
        setOriginalProjectIds(new Set());
        setOriginalImagesSnapshot([]);
        setIsEditingDetailLoading(false);
    };

    const startEdit = async (exp: Experience) => {
        setEditingId(exp.id);
        setEditingData({ ...exp });

        // Relasi akan diload saat ini juga (biar page load awal tidak berat)
        setIsEditingDetailLoading(true);
        setError(null);

        try {
            const r = await fetch(`${API_BASE_URL}/experience/${exp.id}`);
            if (!r.ok) throw new Error('Failed to load experience detail');
            const detail = await r.json();
            const normalized = normalizeExperience(detail);

            const certIds = new Set(
                (normalized.certifications ?? [])
                    .map(c => Number(c.certificationId))
                    .filter(n => !Number.isNaN(n))
            );
            const projectIds = new Set(
                (normalized.projects ?? [])
                    .map(p => Number(p.projectId))
                    .filter(n => !Number.isNaN(n))
            );
            const imagesDraft = (normalized.images ?? []).map(img => ({
                id: img.id,
                imageUrl: img.imageUrl ?? '',
                caption: img.caption ?? '',
            }));

            setEditingData(normalized);
            setEditingCertificationIds(certIds);
            setOriginalCertificationIds(new Set(certIds));
            setEditingProjectIds(projectIds);
            setOriginalProjectIds(new Set(projectIds));
            setEditingImages(imagesDraft);
            setOriginalImagesSnapshot(imagesDraft);
        } catch (err) {
            setError((err as Error).message);
            // fallback: pakai state dari list yang sudah ada
            setEditingCertificationIds(new Set());
            setOriginalCertificationIds(new Set());
            setEditingProjectIds(new Set());
            setOriginalProjectIds(new Set());
            setEditingImages([]);
            setOriginalImagesSnapshot([]);
        } finally {
            setIsEditingDetailLoading(false);
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setIsCreating(false);
        setEditingData({});
        setEditingCertificationIds(new Set());
        setEditingProjectIds(new Set());
        setEditingImages([]);
        setOriginalCertificationIds(new Set());
        setOriginalProjectIds(new Set());
        setOriginalImagesSnapshot([]);
        setIsEditingDetailLoading(false);
    };

    const saveEdit = async () => {
        if (isCreating && !editingId) {
            // CREATE NEW EXPERIENCE
            const company = String(editingData.company ?? '').trim();
            const position = String(editingData.position ?? '').trim();
            if (!company || !position) {
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
                    company,
                    position,
                    logo: String(editingData.logo ?? '').trim() || null,
                    description: String(editingData.description ?? '').trim() || null,
                    startDate: normalizeDateForApi(editingData.startDate as any),
                    endDate: normalizeDateForApi(editingData.endDate as any),
                };

                const response = await fetch(`${API_BASE_URL}/experience`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.text();
                    throw new Error(errData || 'Failed to create experience');
                }

                const newExp = await response.json();
                const newId = newExp.id;

                // Add certifications, projects, and images to the newly created experience
                const desiredCertIds = editingCertificationIds;
                const toAddCerts = Array.from(desiredCertIds);
                const desiredProjectIds = editingProjectIds;
                const toAddProjects = Array.from(desiredProjectIds);
                const imagesToAdd = editingImages.filter(img => img.imageUrl);

                await Promise.all([
                    ...toAddCerts.map(id =>
                        fetch(`${API_BASE_URL}/experience/${newId}/certifications`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ certificationId: id }),
                        }).then(r => {
                            if (!r.ok) throw new Error(`Failed to link certification ${id}`);
                        })
                    ),
                    ...toAddProjects.map(id =>
                        fetch(`${API_BASE_URL}/experience/${newId}/projects`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ projectId: id }),
                        }).then(r => {
                            if (!r.ok) throw new Error(`Failed to link project ${id}`);
                        })
                    ),
                    ...imagesToAdd.map(img =>
                        fetch(`${API_BASE_URL}/experience/${newId}/images`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                imageUrl: img.imageUrl,
                                caption: img.caption,
                            }),
                        }).then(r => {
                            if (!r.ok) throw new Error('Failed to add experience image');
                        })
                    )
                ]);

                await fetchData();
                setEditingId(null);
                setIsCreating(false);
                setEditingData({});
                setEditingCertificationIds(new Set());
                setEditingProjectIds(new Set());
                setEditingImages([]);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsSaving(false);
            }
        } else if (!isCreating && editingId) {
            // EDIT EXISTING EXPERIENCE
            if (!editingId) return;

            const company = String(editingData.company ?? '').trim();
            const position = String(editingData.position ?? '').trim();
            if (!company || !position) {
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
                // 1) Update basic experience fields
                const payload = {
                    company,
                    position,
                    logo: String(editingData.logo ?? '').trim() || null,
                    description: String(editingData.description ?? '').trim() || null,
                    startDate: normalizeDateForApi(editingData.startDate as any),
                    endDate: normalizeDateForApi(editingData.endDate as any),
                };

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

                // 2) Sync certifications relations
                const currentCertIds = originalCertificationIds;
                const desiredCertIds = editingCertificationIds;

                const toAddCerts = Array.from(desiredCertIds).filter(id => !currentCertIds.has(id));
                const toRemoveCerts = Array.from(currentCertIds).filter(id => !desiredCertIds.has(id));

                await Promise.all([
                    ...toAddCerts.map(id =>
                        fetch(`${API_BASE_URL}/experience/${editingId}/certifications`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ certificationId: id }),
                        }).then(r => {
                            if (!r.ok) throw new Error(`Failed to link certification ${id}`);
                        })
                    ),
                    ...toRemoveCerts.map(id =>
                        fetch(`${API_BASE_URL}/experience/${editingId}/certifications/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).then(r => {
                            if (!r.ok) throw new Error(`Failed to unlink certification ${id}`);
                        })
                    )
                ]);

                // 3) Sync projects relations
                const currentProjectIds = originalProjectIds;
                const desiredProjectIds = editingProjectIds;

                const toAddProjects = Array.from(desiredProjectIds).filter(id => !currentProjectIds.has(id));
                const toRemoveProjects = Array.from(currentProjectIds).filter(id => !desiredProjectIds.has(id));

                await Promise.all([
                    ...toAddProjects.map(id =>
                        fetch(`${API_BASE_URL}/experience/${editingId}/projects`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ projectId: id }),
                        }).then(r => {
                            if (!r.ok) throw new Error(`Failed to link project ${id}`);
                        })
                    ),
                    ...toRemoveProjects.map(id =>
                        fetch(`${API_BASE_URL}/experience/${editingId}/projects/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).then(r => {
                            if (!r.ok) throw new Error(`Failed to unlink project ${id}`);
                        })
                    )
                ]);

                // 4) Sync images
                const originalImageIds = new Set(
                    originalImagesSnapshot
                        .map(img => img.id)
                        .filter((id): id is number => typeof id === 'number' && !Number.isNaN(id))
                );

                const sanitizedDrafts = editingImages.map(d => ({
                    id: d.id,
                    imageUrl: String(d.imageUrl ?? '').trim(),
                    caption: String(d.caption ?? '').trim() || null,
                }));

                const keptExistingIds = new Set(
                    sanitizedDrafts.filter(d => d.id != null && d.imageUrl).map(d => d.id as number)
                );

                const toRemoveImages = Array.from(originalImageIds).filter(id => !keptExistingIds.has(id));

                await Promise.all([
                    ...toRemoveImages.map(id =>
                        fetch(`${API_BASE_URL}/experience/${editingId}/images/${id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).then(r => {
                            if (!r.ok) throw new Error(`Failed to delete image ${id}`);
                        })
                    ),
                    ...sanitizedDrafts
                        .filter(d => !d.id && d.imageUrl)
                        .map(d =>
                            fetch(`${API_BASE_URL}/experience/${editingId}/images`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    imageUrl: d.imageUrl,
                                    caption: d.caption,
                                }),
                            }).then(r => {
                                if (!r.ok) throw new Error('Failed to add experience image');
                            })
                        ),
                    ...sanitizedDrafts
                        .filter(d => d.id && d.imageUrl)
                        .map(d =>
                            fetch(`${API_BASE_URL}/experience/${editingId}/images/${d.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    imageUrl: d.imageUrl,
                                    caption: d.caption,
                                }),
                            }).then(r => {
                                if (!r.ok) throw new Error(`Failed to update image ${d.id}`);
                            })
                        )
                ]);

                await fetchData();
                setEditingId(null);
                setEditingData({});
                setEditingCertificationIds(new Set());
                setEditingProjectIds(new Set());
                setEditingImages([]);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsSaving(false);
            }
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
        String(exp.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
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

        // Handle null/undefined values safely for comparison
        if (compareA === null || compareA === undefined) compareA = '';
        if (compareB === null || compareB === undefined) compareB = '';

        if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
        if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination calculations
    const totalPages = Math.ceil(sortedExperiences.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedExperiences = sortedExperiences.slice(startIdx, endIdx);
    const paginatedExperienceIdsKey = paginatedExperiences.map(e => e.id).join(',');

    // Fetch summary counts untuk pengalaman di halaman saat ini (bukan semua).
    useEffect(() => {
        let cancelled = false;

        const ids = paginatedExperiences.map(e => e.id);
        const missing = ids.filter(id => !countsCacheRef.current.has(id));

        if (missing.length === 0) return;
        if (ids.length === 0) return;

        const run = async () => {
            setIsPageCountsLoading(true);
            try {
                const results = await Promise.all(
                    missing.map(async (id) => {
                        try {
                            const r = await fetch(`${API_BASE_URL}/experience/${id}`);
                            if (!r.ok) throw new Error('Failed to load detail');
                            const d = await r.json();
                            const certCount = Array.isArray(d.certifications) ? d.certifications.length : 0;
                            const certNames = (Array.isArray(d.certifications) ? d.certifications : [])
                                .map((c: any) => c?.certification?.name)
                                .filter(Boolean)
                                .slice(0, 2) as string[];
                            const projectCount = Array.isArray(d.projects) ? d.projects.length : 0;
                            const imageCount = Array.isArray(d.images) ? d.images.length : 0;
                            return { id, certCount, certNames, projectCount, imageCount };
                        } catch {
                            return { id, certCount: 0, certNames: [], projectCount: 0, imageCount: 0 };
                        }
                    })
                );

                if (cancelled) return;

                // Update cache + UI state
                const next: typeof countsById = {};
                for (const [k, v] of countsCacheRef.current.entries()) next[k] = v;

                for (const item of results) {
                    countsCacheRef.current.set(item.id, {
                        certCount: item.certCount,
                        certNames: item.certNames,
                        projectCount: item.projectCount,
                        imageCount: item.imageCount,
                    });
                    next[item.id] = {
                        certCount: item.certCount,
                        certNames: item.certNames,
                        projectCount: item.projectCount,
                        imageCount: item.imageCount,
                    };
                }

                setCountsById(next);
            } finally {
                if (!cancelled) setIsPageCountsLoading(false);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [paginatedExperienceIdsKey]);

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
                        {!isCreating && !editingId && (
                            <button
                                onClick={startCreate}
                                className="flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-1 px-4 rounded-lg text-sm"
                            >
                                + Create New
                            </button>
                        )}
                        {(editingId || isCreating) && (
                            <>
                                <button
                                    onClick={saveEdit}
                                    disabled={isSaving || isEditingDetailLoading}
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
                        {selectedIds.size > 0 && !isCreating && !editingId && (
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
                                <th className="px-4 py-2 text-left text-gray-200 font-semibold">Certifications</th>
                                <th className="px-4 py-2 text-left text-gray-200 font-semibold">Projects</th>
                                <th className="px-4 py-2 text-left text-gray-200 font-semibold">Images</th>
                                <th className="px-4 py-2 text-center text-gray-200 font-semibold w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {isCreating && (
                                <tr className="bg-blue-900/20 border-b-2 border-blue-500/50">
                                    <td className="px-4 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            disabled
                                            className="cursor-not-allowed w-4 h-4 rounded border border-gray-500 bg-gray-600"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center text-gray-400 font-medium w-12">
                                        new
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={editingData.position || ''}
                                            placeholder="Job Title"
                                            onChange={(e) => setEditingData(prev => ({ ...prev, position: e.target.value }))}
                                            className="w-auto bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            value={editingData.company || ''}
                                            placeholder="Company Name"
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
                                                placeholder="Logo URL"
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
                                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                                            {allCertifications.map(cert => (
                                                <label key={cert.id} className="flex items-center gap-2 text-xs text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingCertificationIds.has(cert.id)}
                                                        onChange={() => {
                                                            setEditingCertificationIds(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(cert.id)) next.delete(cert.id);
                                                                else next.add(cert.id);
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-3 h-3"
                                                    />
                                                    <span className="truncate" title={cert.name}>{cert.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                                            {allProjects.map(project => (
                                                <label key={project.id} className="flex items-center gap-2 text-xs text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingProjectIds.has(project.id)}
                                                        onChange={() => {
                                                            setEditingProjectIds(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(project.id)) next.delete(project.id);
                                                                else next.add(project.id);
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-3 h-3"
                                                    />
                                                    <span className="truncate" title={project.title}>{project.title}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="space-y-2">
                                            {editingImages.map((img, idx) => (
                                                <div key={img.id ?? idx} className="border border-gray-600 rounded-lg bg-gray-700/30 p-2 space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[11px] text-gray-300 whitespace-nowrap">Image {idx + 1}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingImages(prev => prev.filter((_, i) => i !== idx))}
                                                            className="text-red-400 hover:text-red-300 transition"
                                                            title="Remove image"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {img.imageUrl ? (
                                                        <div className="flex items-center gap-2">
                                                            <img src={img.imageUrl} alt={`image-${idx + 1}`} className="w-10 h-10 rounded object-cover bg-gray-800 border border-gray-600" />
                                                            <input
                                                                type="text"
                                                                value={img.imageUrl}
                                                                onChange={(e) => {
                                                                    const nextValue = e.target.value;
                                                                    setEditingImages(prev => prev.map((it, i) => (i === idx ? { ...it, imageUrl: nextValue } : it)));
                                                                }}
                                                                placeholder="Image URL"
                                                                className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={img.imageUrl}
                                                            onChange={(e) => {
                                                                const nextValue = e.target.value;
                                                                setEditingImages(prev => prev.map((it, i) => (i === idx ? { ...it, imageUrl: nextValue } : it)));
                                                            }}
                                                            placeholder="Image URL"
                                                            className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                        />
                                                    )}

                                                    <input
                                                        type="text"
                                                        value={img.caption}
                                                        onChange={(e) => {
                                                            const nextCaption = e.target.value;
                                                            setEditingImages(prev => prev.map((it, i) => (i === idx ? { ...it, caption: nextCaption } : it)));
                                                        }}
                                                        placeholder="Caption (optional)"
                                                        className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                    />

                                                    <div className="flex items-center gap-2 pt-1">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            ref={el => {
                                                                fileInputRefs.current[idx] = el;
                                                            }}
                                                            onChange={(e) => {
                                                                const f = e.target.files?.[0];
                                                                if (f) void handleUploadExperienceImage(f, idx);
                                                                e.target.value = '';
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => fileInputRefs.current[idx]?.click()}
                                                            disabled={uploadingImageIndex !== null}
                                                            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-white"
                                                            title="Upload to Cloudinary"
                                                        >
                                                            {uploadingImageIndex === idx ? (
                                                                <>
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                    Uploading
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload className="w-3 h-3" />
                                                                    Upload
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            <button
                                                type="button"
                                                onClick={() => setEditingImages(prev => [...prev, { imageUrl: '', caption: '' }])}
                                                className="text-xs text-gray-300 hover:text-white transition"
                                            >
                                                + Add Image
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        {/* Action placeholder for new row */}
                                    </td>
                                </tr>
                            )}
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
                                                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                                                    {allCertifications.map(cert => (
                                                        <label key={cert.id} className="flex items-center gap-2 text-xs text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={editingCertificationIds.has(cert.id)}
                                                                disabled={isEditingDetailLoading}
                                                                onChange={() => {
                                                                    setEditingCertificationIds(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(cert.id)) next.delete(cert.id);
                                                                        else next.add(cert.id);
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="w-3 h-3"
                                                            />
                                                            <span className="truncate" title={cert.name}>{cert.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                                                    {allProjects.map(project => (
                                                        <label key={project.id} className="flex items-center gap-2 text-xs text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={editingProjectIds.has(project.id)}
                                                                disabled={isEditingDetailLoading}
                                                                onChange={() => {
                                                                    setEditingProjectIds(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(project.id)) next.delete(project.id);
                                                                        else next.add(project.id);
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="w-3 h-3"
                                                            />
                                                            <span className="truncate" title={project.title}>{project.title}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="space-y-2">
                                                    {editingImages.map((img, idx) => (
                                                        <div key={img.id ?? idx} className="border border-gray-600 rounded-lg bg-gray-700/30 p-2 space-y-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-[11px] text-gray-300 whitespace-nowrap">Image {idx + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingImages(prev => prev.filter((_, i) => i !== idx))}
                                                                    disabled={isEditingDetailLoading}
                                                                    className="text-red-400 hover:text-red-300 transition"
                                                                    title="Remove image"
                                                                >
                                                                    <Trash className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            {img.imageUrl ? (
                                                                <div className="flex items-center gap-2">
                                                                    <img src={img.imageUrl} alt={`image-${idx + 1}`} className="w-10 h-10 rounded object-cover bg-gray-800 border border-gray-600" />
                                                                    <input
                                                                        type="text"
                                                                        value={img.imageUrl}
                                                                        disabled={isEditingDetailLoading}
                                                                        onChange={(e) => {
                                                                            const nextValue = e.target.value;
                                                                            setEditingImages(prev => prev.map((it, i) => (i === idx ? { ...it, imageUrl: nextValue } : it)));
                                                                        }}
                                                                        placeholder="Image URL"
                                                                        className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={img.imageUrl}
                                                                    disabled={isEditingDetailLoading}
                                                                    onChange={(e) => {
                                                                        const nextValue = e.target.value;
                                                                        setEditingImages(prev => prev.map((it, i) => (i === idx ? { ...it, imageUrl: nextValue } : it)));
                                                                    }}
                                                                    placeholder="Image URL"
                                                                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                                />
                                                            )}

                                                            <input
                                                                type="text"
                                                                value={img.caption}
                                                                disabled={isEditingDetailLoading}
                                                                onChange={(e) => {
                                                                    const nextCaption = e.target.value;
                                                                    setEditingImages(prev => prev.map((it, i) => (i === idx ? { ...it, caption: nextCaption } : it)));
                                                                }}
                                                                placeholder="Caption (optional)"
                                                                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-xs"
                                                            />

                                                            <div className="flex items-center gap-2 pt-1">
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    ref={el => {
                                                                        fileInputRefs.current[idx] = el;
                                                                    }}
                                                                    onChange={(e) => {
                                                                        const f = e.target.files?.[0];
                                                                        if (f) void handleUploadExperienceImage(f, idx);
                                                                        e.target.value = '';
                                                                    }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => fileInputRefs.current[idx]?.click()}
                                                                    disabled={uploadingImageIndex !== null || isEditingDetailLoading}
                                                                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-white"
                                                                    title="Upload to Cloudinary"
                                                                >
                                                                    {uploadingImageIndex === idx ? (
                                                                        <>
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                            Uploading
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Upload className="w-3 h-3" />
                                                                            Upload
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingImages(prev => [...prev, { imageUrl: '', caption: '' }])}
                                                        disabled={isEditingDetailLoading}
                                                        className="text-xs text-gray-300 hover:text-white transition"
                                                    >
                                                        + Add Image
                                                    </button>
                                                </div>
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
                                            <td className="px-4 py-2 text-white font-medium cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => void startEdit(exp)}>
                                                {exp.position}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition" onClick={() => void startEdit(exp)}>
                                                {exp.company}
                                            </td>
                                            <td className="px-4 py-2 text-center cursor-pointer" onClick={() => void startEdit(exp)}>
                                                {exp.logo && (
                                                    <img src={exp.logo} alt={exp.company} className="w-6 h-6 rounded mx-auto" title={exp.company} />
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition text-xs" onClick={() => void startEdit(exp)}>
                                                {formatMonthYear(exp.startDate)} — {formatMonthYear(exp.endDate)}
                                            </td>
                                            <td className="px-4 py-2 text-gray-400 cursor-pointer hover:bg-gray-600/50 text-xs line-clamp-2" onClick={() => void startEdit(exp)}>
                                                {exp.description}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => void startEdit(exp)}>
                                                {countsById[exp.id] ? (
                                                    countsById[exp.id].certNames.length > 0 ? (
                                                        <>
                                                            {countsById[exp.id].certNames.join(', ')}
                                                            {countsById[exp.id].certCount > countsById[exp.id].certNames.length
                                                                ? ` +${countsById[exp.id].certCount - countsById[exp.id].certNames.length} more`
                                                                : ''}
                                                        </>
                                                    ) : (
                                                        countsById[exp.id].certCount > 0
                                                            ? countsById[exp.id].certCount
                                                            : <span className="text-gray-500">—</span>
                                                    )
                                                ) : (
                                                    <span className="text-gray-500">{isPageCountsLoading ? '...' : '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => void startEdit(exp)}>
                                                {countsById[exp.id] ? (
                                                    countsById[exp.id].projectCount > 0 ? countsById[exp.id].projectCount : '—'
                                                ) : (
                                                    <span className="text-gray-500">{isPageCountsLoading ? '...' : '—'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50" onClick={() => void startEdit(exp)}>
                                                {countsById[exp.id] ? (
                                                    countsById[exp.id].imageCount > 0 ? countsById[exp.id].imageCount : '—'
                                                ) : (
                                                    <span className="text-gray-500">{isPageCountsLoading ? '...' : '—'}</span>
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