import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Technology } from '../types';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { API_BASE_URL } from '../config';
import {
  Scissors,
  Rocket,
  Upload,
  Trash,
  Check,
  X,
  Loader2,
  Search
} from "lucide-react";

function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<File> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return Promise.reject(new Error('Canvas context is not available'));
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Canvas is empty'));
                    return;
                }
                const file = new File([blob], 'project-image.jpg', { type: 'image/jpeg' });
                resolve(file);
            },
            'image/jpeg',
            0.95
        );
    });
}

const ProjectManager: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [allTechnologies, setAllTechnologies] = useState<Technology[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingData, setEditingData] = useState<Partial<Project>>({});
    const [newProject, setNewProject] = useState<Partial<Project> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [sortField, setSortField] = useState<'title' | 'description'>('title');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [techDropdownOpen, setTechDropdownOpen] = useState(false);
    const [techSearch, setTechSearch] = useState('');

    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    
    // State for image cropping
    const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
    const [upImg, setUpImg] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [croppingImageIndex, setCroppingImageIndex] = useState<number | null>(null);
    const [croppingContext, setCroppingContext] = useState<{ type: 'edit' | 'new'; id?: number } | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);

    // State for image preview modal (click thumbnail)
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
    const [imagePreviewIndex, setImagePreviewIndex] = useState(0);

    const fetchCerts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [projResponse, techResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/projects`),
                fetch(`${API_BASE_URL}/technologies`)
            ]);
            if (!projResponse.ok) throw new Error('Failed to fetch projects');
            if (!techResponse.ok) throw new Error('Failed to fetch technologies');
            
            const projectsData: Project[] = await projResponse.json();
            const technologiesData: Technology[] = await techResponse.json();
            
            console.log('Fetched projects:', projectsData);
            console.log('Fetched technologies:', technologiesData);
            
            setProjects(projectsData);
            setAllTechnologies(technologiesData);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCerts();
    }, [fetchCerts]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.tech-dropdown-container')) {
                setTechDropdownOpen(false);
            }
        };

        if (techDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [techDropdownOpen]);

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

    const startEdit = (project: Project) => {
        setEditingId(project.id);
        setEditingData({ ...project });
        setTechDropdownOpen(false);
        setTechSearch('');
        setError(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingData({});
        setTechDropdownOpen(false);
        setTechSearch('');
        setError(null);
    };

    const openImagePreview = (urls: string[], index: number) => {
        const cleaned = urls.filter(Boolean);
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
        setImagePreviewIndex(prev => {
            const len = imagePreviewUrls.length;
            if (len <= 1) return prev;
            return (prev - 1 + len) % len;
        });
    };

    const goNextImage = () => {
        setImagePreviewIndex(prev => {
            const len = imagePreviewUrls.length;
            if (len <= 1) return prev;
            return (prev + 1) % len;
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        
        if (!editingData.title?.trim() || !editingData.description?.trim()) {
            setError("Please fill in title and description");
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
            console.log('Saving project with technologies:', editingData.technologies);
            const payload = {
                ...editingData,
                githubLink: editingData.githubLink?.trim() ?? '',
                demoLink: editingData.demoLink?.trim() ?? '',
                videoUrl: editingData.videoUrl?.trim() ?? '',
                technologies: (editingData.technologies || []).map(t => typeof t === 'string' ? t : t.name)
            };

            const response = await fetch(`${API_BASE_URL}/projects/${editingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(errData || 'Failed to update project');
            }
            
            console.log('Project updated successfully');
            await fetchCerts();
            setEditingId(null);
            setEditingData({});
            setTechDropdownOpen(false);
            setTechSearch('');
        } catch (err) {
            console.error('Error saving project:', err);
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Delete this project?")) return;

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete project');
            setProjects(prev => prev.filter(p => p.id !== id));
            if (editingId === id) {
                setEditingId(null);
                setEditingData({});
                setTechDropdownOpen(false);
                setTechSearch('');
            }
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
        if (selectedIds.size === paginatedProjects.length && paginatedProjects.length > 0) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(paginatedProjects.map(p => p.id));
            setSelectedIds(allIds);
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Delete ${selectedIds.size} project(s)?`)) return;

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        const idsToDelete = Array.from(selectedIds);
        
        try {
            await Promise.all(
                idsToDelete.map(id =>
                    fetch(`${API_BASE_URL}/projects/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                )
            );

            setProjects(prev => prev.filter(p => !idsToDelete.includes(p.id)));
            if (editingId !== null && idsToDelete.includes(editingId)) {
                setEditingId(null);
                setEditingData({});
                setTechDropdownOpen(false);
                setTechSearch('');
            }
            setSelectedIds(new Set());
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleImageUpload = async (file: File, imageIndex: number) => {
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setUploadingImageIndex(imageIndex);
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
            
            if (croppingContext?.type === 'edit') {
                const images = editingData.images ? [...editingData.images] : [];
                images[imageIndex] = data.url;
                setEditingData(prev => ({ ...prev, images }));
            } else if (croppingContext?.type === 'new') {
                const images = newProject?.images ? [...newProject.images] : [];
                images[imageIndex] = data.url;
                setNewProject(prev => prev ? { ...prev, images } : null);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploadingImageIndex(null);
        }
    };

    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>, imageIndex: number, context: { type: 'edit' | 'new'; id?: number }) => {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined);
            const selectedFile = e.target.files[0];
            setOriginalFile(selectedFile);
            setCroppingImageIndex(imageIndex);
            setCroppingContext(context);
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setUpImg(reader.result?.toString() || '');
                setIsCropModalOpen(true);
            });
            reader.readAsDataURL(selectedFile);
            e.target.value = '';
        }
    };

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 16 / 9, width, height), width, height);
        setCrop(initialCrop);
    }
    
    const handleCropAndUpload = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current && croppingImageIndex !== null) {
            try {
                const croppedFile = await getCroppedImg(imgRef.current, completedCrop);
                await handleImageUpload(croppedFile, croppingImageIndex);
                setIsCropModalOpen(false);
                setUpImg('');
                setCroppingImageIndex(null);
                setOriginalFile(null);
                setCroppingContext(null);
            } catch (e) {
                console.error(e);
                setError("Could not crop the image. Please try again.");
            }
        }
    };

    const handleUploadWithoutCropping = async () => {
        if (originalFile && croppingImageIndex !== null) {
            await handleImageUpload(originalFile, croppingImageIndex);
            setIsCropModalOpen(false);
            setUpImg('');
            setOriginalFile(null);
            setCroppingImageIndex(null);
            setCroppingContext(null);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedProjects = [...filteredProjects].sort((a, b) => {
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

    const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedProjects = sortedProjects.slice(startIdx, endIdx);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [sortedProjects.length, currentPage, totalPages]);

    const addNewProject = async () => {
        if (!newProject || !newProject.title?.trim() || !newProject.description?.trim()) {
            setError("Please fill in title and description");
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
                title: newProject.title.trim(),
                description: newProject.description.trim(),
                ...(newProject.githubLink?.trim() ? { githubLink: newProject.githubLink.trim() } : {}),
                demoLink: newProject.demoLink?.trim() || '',
                videoUrl: newProject.videoUrl?.trim() || '',
                isFeatured: newProject.isFeatured || false,
                images: newProject.images?.filter(Boolean) || [],
                technologies: (newProject.technologies || []).map(t => typeof t === 'string' ? t : t.name)
            };

            console.log('Creating project with payload:', payload);

            const response = await fetch(`${API_BASE_URL}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(errData || 'Failed to create project');
            }
            
            console.log('Project created successfully');
            await fetchCerts();
            setNewProject(null);
            setTechDropdownOpen(false);
            setTechSearch('');
        } catch (err) {
            console.error('Error creating project:', err);
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const editorContent = () => (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl w-full border border-gray-700 my-2">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-gray-300" />
                {editingId !== null ? 'Edit' : 'Add'} Project
            </h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Title & GitHub */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-200 mb-2">Project Title *</label>
                        <input
                            type="text"
                            value={editingId !== null ? editingData.title || '' : newProject?.title || ''}
                            onChange={(e) => editingId !== null
                                ? setEditingData(prev => ({ ...prev, title: e.target.value }))
                                : setNewProject(prev => prev ? { ...prev, title: e.target.value } : null)
                            }
                            placeholder="Project title"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-200 mb-2">GitHub Link (Optional)</label>
                        <input
                            type="text"
                            value={editingId !== null ? editingData.githubLink || '' : newProject?.githubLink || ''}
                            onChange={(e) => editingId !== null
                                ? setEditingData(prev => ({ ...prev, githubLink: e.target.value }))
                                : setNewProject(prev => prev ? { ...prev, githubLink: e.target.value } : null)
                            }
                            placeholder="https://github.com/..."
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-semibold text-gray-200 mb-2">Description *</label>
                    <textarea
                        value={editingId !== null ? editingData.description || '' : newProject?.description || ''}
                        onChange={(e) => editingId !== null
                            ? setEditingData(prev => ({ ...prev, description: e.target.value }))
                            : setNewProject(prev => prev ? { ...prev, description: e.target.value } : null)
                        }
                        placeholder="Describe your project..."
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm resize-none"
                        rows={2}
                    />
                </div>

                {/* Demo & Video */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-200 mb-2">Demo Link (Optional)</label>
                        <input
                            type="text"
                            value={editingId !== null ? editingData.demoLink || '' : newProject?.demoLink || ''}
                            onChange={(e) => editingId !== null
                                ? setEditingData(prev => ({ ...prev, demoLink: e.target.value }))
                                : setNewProject(prev => prev ? { ...prev, demoLink: e.target.value } : null)
                            }
                            placeholder="https://demo.example.com"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-200 mb-2">YouTube URL (Optional)</label>
                        <input
                            type="text"
                            value={editingId !== null ? editingData.videoUrl || '' : newProject?.videoUrl || ''}
                            onChange={(e) => editingId !== null
                                ? setEditingData(prev => ({ ...prev, videoUrl: e.target.value }))
                                : setNewProject(prev => prev ? { ...prev, videoUrl: e.target.value } : null)
                            }
                            placeholder="https://youtube.com/..."
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                </div>

                {/* Technologies */}
                <div className="bg-gray-700 bg-opacity-50 rounded-lg p-3 border border-gray-600">
                    <h4 className="font-semibold text-white mb-3 text-sm">Technologies</h4>

                    {/* Selected Technologies */}
                    <div className="mb-3">
                        <div className="flex flex-wrap gap-1 p-2 bg-gray-800 rounded-lg min-h-[40px]">
                            {(editingId !== null ? editingData.technologies || [] : newProject?.technologies || []).length > 0 ? (
                                (editingId !== null ? editingData.technologies || [] : newProject?.technologies || []).map((tech, idx) => (
                                    <div
                                        key={`${typeof tech === 'string' ? tech : tech.name}-${idx}`}
                                        className="bg-blue-500 bg-opacity-20 text-blue-200 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-2 hover:bg-opacity-30 transition"
                                    >
                                        <span>{typeof tech === 'string' ? tech : tech.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (editingId !== null) {
                                                    setEditingData(prev => ({
                                                        ...prev,
                                                        technologies: (prev.technologies?.filter((_, i) => i !== idx) || []) as any
                                                    }));
                                                } else {
                                                    setNewProject(prev => prev ? {
                                                        ...prev,
                                                        technologies: (prev.technologies?.filter((_, i) => i !== idx) || []) as any
                                                    } : null);
                                                }
                                            }}
                                            className="hover:text-red-300 font-bold"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-xs">No technologies selected</p>
                            )}
                        </div>
                    </div>

                    {/* Searchable Dropdown */}
                    <div className="relative tech-dropdown-container">
                        <button
                            type="button"
                            onClick={() => setTechDropdownOpen(!techDropdownOpen)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-left text-sm focus:outline-none focus:border-blue-500 flex justify-between items-center hover:bg-gray-600 transition"
                        >
                            <span className="text-gray-300">Select technology...</span>
                            <span className="text-gray-400">{techDropdownOpen ? '▲' : '▼'}</span>
                        </button>

                        {techDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                                {/* Search Input */}
                                <input
                                    type="text"
                                    placeholder="Search technology..."
                                    value={techSearch}
                                    onChange={(e) => setTechSearch(e.target.value.toLowerCase())}
                                    className="w-full px-3 py-2 bg-gray-700 border-b border-gray-600 rounded-t-lg text-white text-sm placeholder-gray-400 focus:outline-none"
                                    autoFocus
                                />

                                {/* Dropdown List */}
                                <div className="max-h-[200px] overflow-y-auto">
                                    {(() => {
                                        const currentTechs = editingId !== null ? editingData.technologies || [] : newProject?.technologies || [];
                                        const selectedNames = new Set(currentTechs.map(t => typeof t === 'string' ? t : t.name));
                                        const filtered = allTechnologies.filter(tech =>
                                            !selectedNames.has(tech.name) &&
                                            tech.name.toLowerCase().includes(techSearch)
                                        );

                                        return filtered.length > 0 ? (
                                            filtered.map((tech) => (
                                                <button
                                                    key={tech.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const projectTech = { name: tech.name, icon: tech.icon };
                                                        if (editingId !== null) {
                                                            setEditingData(prev => ({
                                                                ...prev,
                                                                technologies: [...(prev.technologies || []), projectTech] as any
                                                            }));
                                                        } else {
                                                            setNewProject(prev => prev ? {
                                                                ...prev,
                                                                technologies: [...(prev.technologies || []), projectTech] as any
                                                            } : null);
                                                        }
                                                        setTechSearch('');
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-700 transition block"
                                                >
                                                    {tech.name}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-gray-400 text-xs">
                                                {techSearch ? 'No matching technology' : 'All technologies selected'}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Project Images */}
                <div className="bg-gray-700 bg-opacity-50 rounded-lg p-3 border border-gray-600">
                    <h4 className="font-semibold text-white mb-2 text-sm">Project Images</h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto mb-3">
                        {(editingId !== null ? editingData.images || [] : newProject?.images || []).map((img, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={img || ''}
                                    onChange={(e) => {
                                        if (editingId !== null) {
                                            const images = [...(editingData.images || [])];
                                            images[idx] = e.target.value;
                                            setEditingData(prev => ({ ...prev, images }));
                                        } else {
                                            const images = [...(newProject?.images || [])];
                                            images[idx] = e.target.value;
                                            setNewProject(prev => prev ? { ...prev, images } : null);
                                        }
                                    }}
                                    placeholder="Image URL"
                                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                                />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={el => { fileInputRefs.current[idx] = el; }}
                                    onChange={(e) => onSelectFile(e, idx, editingId !== null ? { type: 'edit', id: editingId } : { type: 'new' })}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRefs.current[idx]?.click()}
                                    disabled={uploadingImageIndex === idx}
                                    className="bg-gray-600 hover:bg-gray-500 text-white font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
                                >
                                    {uploadingImageIndex === idx ? '...' : 'Upload'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingId !== null) {
                                            setEditingData(prev => ({
                                                ...prev,
                                                images: prev.images?.filter((_, i) => i !== idx)
                                            }));
                                        } else {
                                            setNewProject(prev => prev ? {
                                                ...prev,
                                                images: prev.images?.filter((_, i) => i !== idx)
                                            } : null);
                                        }
                                    }}
                                    className="text-red-400 hover:text-red-300 text-sm"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (editingId !== null) {
                                setEditingData(prev => ({ ...prev, images: [...(prev.images || []), ''] }));
                            } else {
                                setNewProject(prev => prev ? { ...prev, images: [...(prev.images || []), ''] } : null);
                            }
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs font-semibold"
                    >
                        + Add Image
                    </button>
                </div>

                {/* Featured Checkbox */}
                <label className="flex items-center gap-2 text-gray-200 cursor-pointer hover:text-white transition text-sm">
                    <input
                        type="checkbox"
                        checked={editingId !== null ? editingData.isFeatured || false : newProject?.isFeatured || false}
                        onChange={(e) => {
                            if (editingId !== null) {
                                setEditingData(prev => ({ ...prev, isFeatured: e.target.checked }));
                            } else {
                                setNewProject(prev => prev ? { ...prev, isFeatured: e.target.checked } : null);
                            }
                        }}
                        className="w-4 h-4 rounded bg-gray-700 border border-gray-600"
                    />
                    <span className="font-medium">Mark as Featured Project</span>
                </label>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-600">
                <button
                    onClick={() => {
                        setEditingId(null);
                        setEditingData({});
                        setNewProject(null);
                        setError(null);
                        setTechDropdownOpen(false);
                        setTechSearch('');
                    }}
                    disabled={isSaving}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={editingId !== null ? saveEdit : addNewProject}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : editingId !== null ? 'Update' : 'Save'}
                </button>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-gray-800 p-4 rounded-2xl shadow-xl border border-gray-700">
            {isCropModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 p-4 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <Scissors className="w-5 h-5 text-gray-300" />
                            Crop Project Image
                        </h3>
                        {upImg && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                keepSelection
                                minWidth={100}
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop me"
                                    src={upImg}
                                    onLoad={onImageLoad}
                                    className="max-h-[60vh] mx-auto rounded-lg"
                                />
                            </ReactCrop>
                        )}
                        <div className="flex flex-wrap justify-end gap-2 mt-4 pt-4 border-t border-gray-600">
                            <button type="button" onClick={() => { setIsCropModalOpen(false); setUpImg(''); }} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-4 rounded-lg transition-colors text-sm">Cancel</button>
                            <button type="button" onClick={handleUploadWithoutCropping} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm" disabled={uploadingImageIndex !== null}>
                                Upload Full Size
                            </button>
                            <button type="button" onClick={handleCropAndUpload} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-1 px-4 rounded-lg transition-all disabled:opacity-50 text-sm" disabled={!completedCrop?.width || uploadingImageIndex !== null}>
                                {uploadingImageIndex !== null ? 'Uploading...' : 'Crop & Upload'}
                            </button>
                        </div>
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
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                Image Preview
                            </h3>
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
                            <span className="text-gray-500">
                                Tip: gunakan tombol panah kiri/kanan
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Rocket className="w-5 h-5" />
                        Projects
                    </h2>
                    <div className="flex gap-2">
                        {editingId !== null && (
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
                            onClick={() => {
                                setTechDropdownOpen(false);
                                setTechSearch('');
                                setError(null);
                                setNewProject({
                                    title: '',
                                    description: '',
                                    githubLink: '',
                                    demoLink: '',
                                    videoUrl: '',
                                    isFeatured: false,
                                    technologies: [],
                                    images: []
                                });
                            }}
                            disabled={newProject !== null || editingId !== null}
                            className="flex items-center gap-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-1 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Rocket className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search projects..."
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
                <div className="max-h-80 overflow-y-auto border border-gray-700 rounded-lg">
                    <table className="w-max min-w-full text-xs">
                        <thead className="sticky top-0 bg-gray-700 border-b border-gray-600 z-10">
                            <tr>
                                <th className="px-2 py-1 text-center text-gray-200 font-semibold">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size > 0 && selectedIds.size === paginatedProjects.length && paginatedProjects.length > 0}
                                        onChange={toggleSelectAll}
                                        className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                    />
                                </th>
                                <th className="px-2 py-1 text-center text-gray-200 font-semibold">No.</th>
                                <th className="px-2 py-1 text-center text-gray-200 font-semibold">Actions</th>
                                <th 
                                    className="px-2 py-1 text-left text-gray-200 font-semibold cursor-pointer hover:bg-gray-600/50 transition"
                                    onClick={() => {
                                        setSortField('title');
                                        setSortOrder(sortField === 'title' && sortOrder === 'asc' ? 'desc' : 'asc');
                                    }}
                                >
                                    Title {sortField === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-2 py-1 text-left text-gray-200 font-semibold">GitHub</th>
                                <th className="px-2 py-1 text-left text-gray-200 font-semibold">Demo</th>
                                <th className="px-2 py-1 text-left text-gray-200 font-semibold">Video</th>
                                <th className="px-2 py-1 text-center text-gray-200 font-semibold">Featured</th>
                                <th className="px-2 py-1 text-left text-gray-200 font-semibold">Technologies</th>
                                <th className="px-2 py-1 text-left text-gray-200 font-semibold">Images</th>
                                <th className="px-2 py-1 text-left text-gray-200 font-semibold w-[440px] min-w-[440px]">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {/* Existing Projects */}
                            {paginatedProjects.map((proj, index) => (
                                <tr key={proj.id} className="hover:bg-gray-700/50 transition">
                                    <td className="px-2 py-1 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(proj.id)}
                                            onChange={() => toggleSelect(proj.id)}
                                            className="cursor-pointer w-4 h-4 rounded border border-gray-500 bg-gray-600 checked:bg-blue-600 focus:outline-none"
                                        />
                                    </td>

                                    <td className="px-2 py-1 text-center text-gray-400 font-medium">
                                        {startIdx + index + 1}
                                    </td>

                                    {editingId === proj.id ? (
                                        <>
                                            {/* Actions */}
                                            <td className="px-1 py-1 align-top">
                                                <div className="flex flex-wrap gap-0.5 justify-center items-center pt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); void saveEdit(); }}
                                                        disabled={isSaving}
                                                        className="p-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white disabled:opacity-50"
                                                        title="Save"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                                        disabled={isSaving}
                                                        className="p-1 rounded-md bg-gray-600 hover:bg-gray-500 text-white disabled:opacity-50"
                                                        title="Cancel"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); void handleDelete(proj.id); }}
                                                        disabled={isSaving}
                                                        className="p-1 rounded-md bg-red-500/20 hover:bg-red-500/35 text-red-300 disabled:opacity-50"
                                                        title="Delete"
                                                    >
                                                        <Trash className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Title */}
                                            <td className="px-2 py-1 min-w-[220px]">
                                                <input
                                                    type="text"
                                                    value={editingData.title || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, title: e.target.value }))}
                                                    placeholder="Project title *"
                                                    className="w-full min-w-0 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>

                                            {/* GitHub */}
                                            <td className="px-2 py-1 min-w-[260px]">
                                                <input
                                                    type="text"
                                                    value={editingData.githubLink || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, githubLink: e.target.value }))}
                                                    placeholder="GitHub link (optional)"
                                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>

                                            {/* Demo */}
                                            <td className="px-2 py-1 min-w-[190px]">
                                                <input
                                                    type="text"
                                                    value={editingData.demoLink || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, demoLink: e.target.value }))}
                                                    placeholder="Demo link (optional)"
                                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>

                                            {/* Video */}
                                            <td className="px-2 py-1 min-w-[190px]">
                                                <input
                                                    type="text"
                                                    value={editingData.videoUrl || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, videoUrl: e.target.value }))}
                                                    placeholder="YouTube URL (optional)"
                                                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                                />
                                            </td>

                                            {/* Featured */}
                                            <td className="px-2 py-1 text-center min-w-[90px]">
                                                <input
                                                    type="checkbox"
                                                    checked={editingData.isFeatured || false}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                                                    className="cursor-pointer w-4 h-4 rounded bg-gray-700 border border-gray-600"
                                                    title="Featured"
                                                />
                                            </td>

                                            {/* Technologies */}
                                            <td className="px-2 py-1 align-top min-w-[260px]">
                                                <div className="rounded-md border border-gray-600/90 bg-gray-900/30 p-2 space-y-2 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Technologies</div>
                                                    <div className="flex flex-wrap gap-1 max-h-[76px] overflow-y-auto pr-0.5">
                                                        {(editingData.technologies || []).length > 0 ? (
                                                            (editingData.technologies || []).map((tech: any, idx: number) => (
                                                                <span
                                                                    key={`${typeof tech === 'string' ? tech : tech.name}-${idx}`}
                                                                    className="inline-flex items-center gap-1 max-w-full rounded-md border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-medium text-blue-200"
                                                                >
                                                                    <span className="truncate">{typeof tech === 'string' ? tech : tech.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingData(prev => ({
                                                                                ...prev,
                                                                                technologies: (prev.technologies?.filter((_, i) => i !== idx) || []) as any
                                                                            }));
                                                                        }}
                                                                        className="shrink-0 text-gray-400 hover:text-red-300"
                                                                        aria-label="Remove"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-500 text-[11px]">None selected</span>
                                                        )}
                                                    </div>

                                                    <div className="relative tech-dropdown-container">
                                                        <button
                                                            type="button"
                                                            onClick={() => setTechDropdownOpen(!techDropdownOpen)}
                                                            className="w-full min-w-0 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded-md text-white text-left text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500/60 flex justify-between items-center gap-1 hover:bg-gray-700/80"
                                                        >
                                                            <span className="text-gray-400 truncate">Add technology…</span>
                                                            <span className="text-gray-500 shrink-0">{techDropdownOpen ? '▲' : '▼'}</span>
                                                        </button>

                                                        {techDropdownOpen && (
                                                            <div className="absolute left-0 right-0 top-full z-[60] mt-1 rounded-md border border-gray-600 bg-gray-800 shadow-xl overflow-hidden">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search…"
                                                                    value={techSearch}
                                                                    onChange={(e) => setTechSearch(e.target.value.toLowerCase())}
                                                                    className="w-full px-2 py-1.5 bg-gray-800 border-b border-gray-600 text-white text-[11px] placeholder-gray-500 focus:outline-none"
                                                                    autoFocus
                                                                />
                                                                <div className="max-h-[160px] overflow-y-auto">
                                                                    {(() => {
                                                                        const currentTechs = (editingData.technologies || []) as any[];
                                                                        const selectedNames = new Set(currentTechs.map(t => typeof t === 'string' ? t : t.name));
                                                                        const filtered = allTechnologies.filter(tech =>
                                                                            !selectedNames.has(tech.name) &&
                                                                            tech.name.toLowerCase().includes(techSearch)
                                                                        );
                                                                        return filtered.length > 0 ? (
                                                                            filtered.map((tech) => {
                                                                                const projectTech = { name: tech.name, icon: tech.icon };
                                                                                return (
                                                                                    <button
                                                                                        key={tech.id}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setEditingData(prev => ({
                                                                                                ...prev,
                                                                                                technologies: [...(prev.technologies || []), projectTech] as any
                                                                                            }));
                                                                                            setTechSearch('');
                                                                                        }}
                                                                                        className="w-full px-2 py-1.5 text-left text-[11px] text-gray-200 hover:bg-gray-700"
                                                                                    >
                                                                                        {tech.name}
                                                                                    </button>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <div className="px-2 py-2 text-gray-500 text-[11px]">
                                                                                {techSearch ? 'No match' : 'All added'}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Images */}
                                            <td className="px-2 py-1 align-top min-w-[300px]">
                                                <div className="rounded-md border border-gray-600/90 bg-gray-900/30 p-2 space-y-2 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Images</div>
                                                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-0.5">
                                                        {(editingData.images || []).map((img: any, idx: number) => (
                                                            <div key={idx} className="rounded-md border border-gray-600/70 bg-gray-800/40 p-1.5 space-y-1.5 min-w-0">
                                                                <input
                                                                    type="text"
                                                                    value={img || ''}
                                                                    onChange={(e) => {
                                                                        setEditingData(prev => {
                                                                            const images = [...(prev.images || [])];
                                                                            images[idx] = e.target.value;
                                                                            return { ...prev, images };
                                                                        });
                                                                    }}
                                                                    placeholder="Image URL"
                                                                    className="w-full min-w-0 px-2 py-1 bg-gray-900/50 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-[11px]"
                                                                />
                                                                <div className="flex gap-1 justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const urls = (editingData.images || []).filter(Boolean) as string[];
                                                                            const current = (img || '').toString().trim();
                                                                            if (!current) return;
                                                                            const startIndex = Math.max(0, urls.indexOf(current));
                                                                            openImagePreview(urls, startIndex);
                                                                        }}
                                                                        disabled={!img || !(img || '').toString().trim()}
                                                                        className="px-2 py-0.5 rounded-md border border-blue-500/30 text-blue-200 hover:bg-blue-500/10 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    >
                                                                        Preview
                                                                    </button>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        ref={el => { fileInputRefs.current[idx] = el; }}
                                                                        onChange={(e) => onSelectFile(e, idx, { type: 'edit', id: proj.id })}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => fileInputRefs.current[idx]?.click()}
                                                                        disabled={uploadingImageIndex === idx}
                                                                        className="px-2 py-0.5 rounded-md bg-gray-600 hover:bg-gray-500 text-white text-[11px] disabled:opacity-50"
                                                                    >
                                                                        {uploadingImageIndex === idx ? '…' : 'Upload'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingData(prev => ({
                                                                                ...prev,
                                                                                images: (prev.images || []).filter((_, i) => i !== idx)
                                                                            }));
                                                                        }}
                                                                        className="px-2 py-0.5 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10 text-[11px]"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingData(prev => ({ ...prev, images: [...(prev.images || []), ''] }));
                                                        }}
                                                        className="w-full py-1 rounded-md border border-dashed border-gray-600 text-[11px] font-medium text-blue-300 hover:bg-gray-800/80"
                                                    >
                                                        + Add image URL
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td className="px-2 py-1 min-w-[440px]">
                                                <textarea
                                                    value={editingData.description || ''}
                                                    onChange={(e) => setEditingData(prev => ({ ...prev, description: e.target.value }))}
                                                    placeholder="Describe your project *"
                                                    className="w-full min-w-[420px] px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs leading-relaxed resize-y"
                                                    rows={4}
                                                />
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-1 py-1 align-top">
                                                <div className="flex justify-center pt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); void handleDelete(proj.id); }}
                                                        disabled={isSaving}
                                                        className="p-1 rounded-md bg-red-500/15 hover:bg-red-500/30 text-red-300 disabled:opacity-50"
                                                        title="Delete"
                                                    >
                                                        <Trash className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td
                                                className="px-2 py-1 text-white font-medium text-sm cursor-pointer hover:bg-gray-600/50 hover:text-blue-300 transition"
                                                onClick={() => startEdit(proj)}
                                            >
                                                <span className="truncate block" title={proj.title}>{proj.title}</span>
                                            </td>
                                            <td
                                                className="px-2 py-1 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50 transition"
                                                onClick={() => startEdit(proj)}
                                            >
                                                {proj.githubLink ? (
                                                    <a
                                                        href={proj.githubLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:text-blue-300 transition-none truncate block"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={proj.githubLink}
                                                    >
                                                        {proj.githubLink}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-2 py-1 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50 transition"
                                                onClick={() => startEdit(proj)}
                                            >
                                                {proj.demoLink ? (
                                                    <a
                                                        href={proj.demoLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:text-blue-300 transition-none truncate block"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={proj.demoLink}
                                                    >
                                                        {proj.demoLink}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-2 py-1 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50 transition"
                                                onClick={() => startEdit(proj)}
                                            >
                                                {proj.videoUrl ? (
                                                    <a
                                                        href={proj.videoUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:text-blue-300 transition-none truncate block"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={proj.videoUrl}
                                                    >
                                                        {proj.videoUrl}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-2 py-1 text-center text-gray-300 cursor-pointer hover:bg-gray-600/50 transition"
                                                onClick={() => startEdit(proj)}
                                            >
                                                {proj.isFeatured ? 'Yes' : 'No'}
                                            </td>
                                            <td
                                                className="px-2 py-1 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50 transition"
                                                onClick={() => startEdit(proj)}
                                            >
                                                {proj.technologies?.slice(0, 2).map((t: any) => t.name || t).join(', ')}
                                                {proj.technologies && proj.technologies.length > 2 && ` +${proj.technologies.length - 2}`}
                                            </td>
                                            <td
                                                className="px-2 py-1 text-gray-400 text-xs cursor-pointer hover:bg-gray-600/50 transition"
                                                onClick={() => startEdit(proj)}
                                            >
                                                {(proj.images || []).length > 0 ? (
                                                    <span className="truncate block" title={(proj.images || []).join('\n')}>
                                                        {(proj.images || []).length} image(s)
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-2 py-1 text-gray-300 text-xs cursor-pointer hover:bg-gray-600/50 transition"
                                                onClick={() => startEdit(proj)}
                                                title={proj.description}
                                            >
                                                <span className="block whitespace-normal break-words leading-relaxed max-h-[3.6rem] overflow-hidden">
                                                    {proj.description}
                                                </span>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}

                            {/* New Project Row */}
                            {newProject !== null && (
                                <tr className="bg-gray-700/50 border-t-2 border-green-500">
                                    <td className="px-2 py-1 text-center">
                                        {/* Checkbox disabled for new rows */}
                                    </td>
                                    <td className="px-2 py-1 text-center text-gray-400 font-medium">
                                        New
                                    </td>

                                    {/* Actions */}
                                    <td className="px-1 py-1 align-top">
                                        <div className="flex flex-wrap gap-0.5 justify-center items-center pt-0.5">
                                            <button
                                                type="button"
                                                onClick={() => void addNewProject()}
                                                disabled={isSaving}
                                                className="p-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white disabled:opacity-50"
                                                title="Save"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewProject(null);
                                                    setError(null);
                                                    setTechDropdownOpen(false);
                                                    setTechSearch('');
                                                }}
                                                disabled={isSaving}
                                                className="p-1 rounded-md bg-gray-600 hover:bg-gray-500 text-white disabled:opacity-50"
                                                title="Cancel"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>

                                    {/* Title */}
                                    <td className="px-2 py-1 min-w-[220px]">
                                        <input
                                            type="text"
                                            value={newProject.title || ''}
                                            onChange={(e) => setNewProject(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                            placeholder="Project title *"
                                            className="w-full min-w-0 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                        />
                                    </td>

                                    {/* GitHub */}
                                    <td className="px-2 py-1 min-w-[260px]">
                                        <input
                                            type="text"
                                            value={newProject.githubLink || ''}
                                            onChange={(e) => setNewProject(prev => prev ? { ...prev, githubLink: e.target.value } : prev)}
                                            placeholder="GitHub link (optional)"
                                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                        />
                                    </td>

                                    {/* Demo */}
                                    <td className="px-2 py-1 min-w-[190px]">
                                        <input
                                            type="text"
                                            value={newProject.demoLink || ''}
                                            onChange={(e) => setNewProject(prev => prev ? { ...prev, demoLink: e.target.value } : prev)}
                                            placeholder="Demo link (optional)"
                                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                        />
                                    </td>

                                    {/* Video */}
                                    <td className="px-2 py-1 min-w-[190px]">
                                        <input
                                            type="text"
                                            value={newProject.videoUrl || ''}
                                            onChange={(e) => setNewProject(prev => prev ? { ...prev, videoUrl: e.target.value } : prev)}
                                            placeholder="YouTube URL (optional)"
                                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs"
                                        />
                                    </td>

                                    {/* Featured */}
                                    <td className="px-2 py-1 text-center min-w-[90px]">
                                        <input
                                            type="checkbox"
                                            checked={newProject.isFeatured || false}
                                            onChange={(e) => setNewProject(prev => prev ? { ...prev, isFeatured: e.target.checked } : prev)}
                                            className="cursor-pointer w-4 h-4 rounded bg-gray-700 border border-gray-600"
                                            title="Featured"
                                        />
                                    </td>

                                    {/* Technologies */}
                                    <td className="px-2 py-1 align-top min-w-[260px]">
                                        <div className="rounded-md border border-gray-600/90 bg-gray-900/30 p-2 space-y-2 min-w-0">
                                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Technologies</div>
                                            <div className="flex flex-wrap gap-1 max-h-[76px] overflow-y-auto pr-0.5">
                                                {(newProject.technologies || []).length > 0 ? (
                                                    (newProject.technologies || []).map((tech: any, idx: number) => (
                                                        <span
                                                            key={`${typeof tech === 'string' ? tech : tech.name}-${idx}`}
                                                            className="inline-flex items-center gap-1 max-w-full rounded-md border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-medium text-blue-200"
                                                        >
                                                            <span className="truncate">{typeof tech === 'string' ? tech : tech.name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewProject(prev => {
                                                                        if (!prev) return prev;
                                                                        return {
                                                                            ...prev,
                                                                            technologies: (prev.technologies || []).filter((_, i) => i !== idx) as any
                                                                        };
                                                                    });
                                                                }}
                                                                className="shrink-0 text-gray-400 hover:text-red-300"
                                                                aria-label="Remove"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-500 text-[11px]">None selected</span>
                                                )}
                                            </div>

                                            <div className="relative tech-dropdown-container">
                                                <button
                                                    type="button"
                                                    onClick={() => setTechDropdownOpen(!techDropdownOpen)}
                                                    className="w-full min-w-0 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded-md text-white text-left text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500/60 flex justify-between items-center gap-1 hover:bg-gray-700/80"
                                                >
                                                    <span className="text-gray-400 truncate">Add technology…</span>
                                                    <span className="text-gray-500 shrink-0">{techDropdownOpen ? '▲' : '▼'}</span>
                                                </button>

                                                {techDropdownOpen && (
                                                    <div className="absolute left-0 right-0 top-full z-[60] mt-1 rounded-md border border-gray-600 bg-gray-800 shadow-xl overflow-hidden">
                                                        <input
                                                            type="text"
                                                            placeholder="Search…"
                                                            value={techSearch}
                                                            onChange={(e) => setTechSearch(e.target.value.toLowerCase())}
                                                            className="w-full px-2 py-1.5 bg-gray-800 border-b border-gray-600 text-white text-[11px] placeholder-gray-500 focus:outline-none"
                                                            autoFocus
                                                        />
                                                        <div className="max-h-[160px] overflow-y-auto">
                                                            {(() => {
                                                                const currentTechs = (newProject.technologies || []) as any[];
                                                                const selectedNames = new Set(currentTechs.map(t => typeof t === 'string' ? t : t.name));
                                                                const filtered = allTechnologies.filter(tech =>
                                                                    !selectedNames.has(tech.name) &&
                                                                    tech.name.toLowerCase().includes(techSearch)
                                                                );
                                                                return filtered.length > 0 ? (
                                                                    filtered.map((tech) => {
                                                                        const projectTech = { name: tech.name, icon: tech.icon };
                                                                        return (
                                                                            <button
                                                                                key={tech.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setNewProject(prev => {
                                                                                        if (!prev) return prev;
                                                                                        return {
                                                                                            ...prev,
                                                                                            technologies: [...(prev.technologies || []), projectTech] as any
                                                                                        };
                                                                                    });
                                                                                    setTechSearch('');
                                                                                }}
                                                                                className="w-full px-2 py-1.5 text-left text-[11px] text-gray-200 hover:bg-gray-700"
                                                                            >
                                                                                {tech.name}
                                                                            </button>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="px-2 py-2 text-gray-500 text-[11px]">
                                                                        {techSearch ? 'No match' : 'All added'}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Images */}
                                    <td className="px-2 py-1 align-top min-w-[300px]">
                                        <div className="rounded-md border border-gray-600/90 bg-gray-900/30 p-2 space-y-2 min-w-0">
                                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Images</div>
                                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-0.5">
                                                {(newProject.images || []).map((img: any, idx: number) => (
                                                    <div key={idx} className="rounded-md border border-gray-600/70 bg-gray-800/40 p-1.5 space-y-1.5 min-w-0">
                                                        <input
                                                            type="text"
                                                            value={img || ''}
                                                            onChange={(e) => {
                                                                setNewProject(prev => {
                                                                    if (!prev) return prev;
                                                                    const images = [...(prev.images || [])];
                                                                    images[idx] = e.target.value;
                                                                    return { ...prev, images };
                                                                });
                                                            }}
                                                            placeholder="Image URL"
                                                            className="w-full min-w-0 px-2 py-1 bg-gray-900/50 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-[11px]"
                                                        />
                                                        <div className="flex gap-1 justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const urls = (newProject.images || []).filter(Boolean) as string[];
                                                                    const current = (img || '').toString().trim();
                                                                    if (!current) return;
                                                                    const startIndex = Math.max(0, urls.indexOf(current));
                                                                    openImagePreview(urls, startIndex);
                                                                }}
                                                                disabled={!img || !(img || '').toString().trim()}
                                                                className="px-2 py-0.5 rounded-md border border-blue-500/30 text-blue-200 hover:bg-blue-500/10 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                                                            >
                                                                Preview
                                                            </button>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                ref={el => { fileInputRefs.current[idx] = el; }}
                                                                onChange={(e) => onSelectFile(e, idx, { type: 'new' })}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => fileInputRefs.current[idx]?.click()}
                                                                disabled={uploadingImageIndex === idx}
                                                                className="px-2 py-0.5 rounded-md bg-gray-600 hover:bg-gray-500 text-white text-[11px] disabled:opacity-50"
                                                            >
                                                                {uploadingImageIndex === idx ? '…' : 'Upload'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewProject(prev => {
                                                                        if (!prev) return prev;
                                                                        return {
                                                                            ...prev,
                                                                            images: (prev.images || []).filter((_, i) => i !== idx)
                                                                        };
                                                                    });
                                                                }}
                                                                className="px-2 py-0.5 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10 text-[11px]"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewProject(prev => prev ? { ...prev, images: [...(prev.images || []), ''] } : prev);
                                                }}
                                                className="w-full py-1 rounded-md border border-dashed border-gray-600 text-[11px] font-medium text-blue-300 hover:bg-gray-800/80"
                                            >
                                                + Add image URL
                                            </button>
                                        </div>
                                    </td>

                                    {/* Description */}
                                    <td className="px-2 py-1 min-w-[440px]">
                                        <textarea
                                            value={newProject.description || ''}
                                            onChange={(e) => setNewProject(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                            placeholder="Describe your project *"
                                            className="w-full min-w-[420px] px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-xs leading-relaxed resize-y"
                                            rows={4}
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {sortedProjects.length > 0 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                        <div className="text-sm text-gray-400">
                            Showing {startIdx + 1} to {Math.min(endIdx, sortedProjects.length)} of {sortedProjects.length} items
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

            {projects.length === 0 && !newProject && (
                <div className="text-center py-8 text-gray-400">
                    No projects yet. Click "Add" to create one!
                </div>
            )}
        </div>
    );
};

export default ProjectManager;
