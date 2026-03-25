import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, Technology } from '../types';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { API_BASE_URL } from '../config';
import {
  Scissors,
  Rocket,
  Upload,
  Trash2,
  Pencil,
  Star,
  XCircle,
  Loader2,
  ImagePlus
} from "lucide-react";

type ProjectFormState = Omit<Project, 'id' | 'technologies' | 'demoLink' | 'videoUrl'> & {
    technologies: string[];
    demoLink: string;
    videoUrl: string;
};

const initialFormData: ProjectFormState = {
    title: '', description: '', githubLink: '', demoLink: '', videoUrl: '', isFeatured: false, technologies: [], images: []
};

// Helper function to generate a cropped image file from a canvas
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
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);

    const [formData, setFormData] = useState(initialFormData);
    const [newTechInput, setNewTechInput] = useState('');

    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    
    // State for image cropping
    const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
    const [upImg, setUpImg] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [croppingImageIndex, setCroppingImageIndex] = useState<number | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);


    const fetchData = useCallback(async () => {
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
            
            setProjects(projectsData);
            setAllTechnologies(technologiesData);
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
        if (editingProject) {
            setFormData({
                title: editingProject.title,
                description: editingProject.description,
                githubLink: editingProject.githubLink,
                demoLink: editingProject.demoLink || '',
                videoUrl: editingProject.videoUrl || '',
                isFeatured: editingProject.isFeatured,
                technologies: editingProject.technologies.map(tech => tech.name),
                images: editingProject.images
            });
        } else {
            setFormData(initialFormData);
        }
        setNewTechInput('');
    }, [editingProject]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    
    const handleSelectTechnology = (techName: string) => {
        if (!formData.technologies.includes(techName)) {
            setFormData(prev => ({...prev, technologies: [...prev.technologies, techName]}));
        }
    };

    const handleDeselectTechnology = (techName: string) => {
        setFormData(prev => ({...prev, technologies: prev.technologies.filter(t => t !== techName)}));
    };

    const handleAddNewTechnology = () => {
        const trimmedInput = newTechInput.trim();
        if (trimmedInput && !formData.technologies.includes(trimmedInput)) {
            setFormData(prev => ({...prev, technologies: [...prev.technologies, trimmedInput]}));
            setNewTechInput('');
        }
    };
    
    const handleImageChange = (index: number, value: string) => {
        const newImages = [...formData.images];
        newImages[index] = value;
        setFormData(prev => ({...prev, images: newImages}));
    };
    
    const handleAddImageField = () => {
        setFormData(prev => ({...prev, images: [...prev.images, '']}));
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setFormData(prev => ({...prev, images: prev.images.filter((_, index) => index !== indexToRemove)}));
    };
    
    const handleImageUpload = async (file: File, index: number) => {
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setUploadingImageIndex(index);
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
            
            handleImageChange(index, data.url);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploadingImageIndex(null);
        }
    };

    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined);
            const selectedFile = e.target.files[0];
            setOriginalFile(selectedFile);
            setCroppingImageIndex(index);
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
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        const finalFormData = {
            ...formData,
            images: formData.images.map(i => i.trim()).filter(Boolean),
            videoUrl: formData.videoUrl?.trim() ? formData.videoUrl.trim() : null,
        };

        const method = editingProject ? 'PUT' : 'POST';
        const url = editingProject ? `${API_BASE_URL}/projects/${editingProject.id}` : `${API_BASE_URL}/projects`;

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(finalFormData)
            });
            if (!response.ok) throw new Error(`Failed to ${editingProject ? 'update' : 'create'} project`);
            
            await fetchData();
            closeForm();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure?")) return;
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete project');
            
            setProjects(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            setError((err as Error).message);
        }
    };
    
    const openForm = (proj: Project | null = null) => {
        setEditingProject(proj);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setEditingProject(null);
        setIsFormOpen(false);
        setError(null);
    };

    const availableTechnologies = allTechnologies.filter(tech => !formData.technologies.includes(tech.name));
    
    if (fileInputRefs.current.length !== formData.images.length) {
        fileInputRefs.current.length = formData.images.length;
    }

    return (
        <div>
            {isCropModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 p-4 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <Scissors className="w-5 h-5 text-gray-300" />
                            Crop Project Image
                        </h3>
                        <p className="text-gray-400 text-xs mb-4">Optionally crop the image, or upload it in full resolution.</p>
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

            {isFormOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 p-4 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Rocket className="w-5 h-5 text-gray-300" />
                            {editingProject ? 'Edit' : 'Add'} Project
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-200 mb-2">Project Title</label>
                                <input name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g., E-Commerce Platform" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"/>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-200 mb-2">Description</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Describe your project..." required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none" rows={3}></textarea>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-200 mb-2">GitHub Link</label>
                                    <input name="githubLink" value={formData.githubLink} onChange={handleInputChange} placeholder="https://github.com/..." required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-200 mb-2">Demo Link</label>
                                    <input name="demoLink" value={formData.demoLink} onChange={handleInputChange} placeholder="https://demo.com (Optional)" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"/>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-200 mb-2">YouTube Video URL</label>
                                <input name="videoUrl" value={formData.videoUrl} onChange={handleInputChange} placeholder="https://youtube.com/... (Optional)" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"/>
                            </div>

                            <div className="bg-gray-700 bg-opacity-50 rounded-xl p-3 border border-gray-600">
                                <h4 className="font-semibold text-white mb-3">Technologies</h4>
                                {/* Selected */}
                                <label className="block text-xs text-gray-300 mb-2 font-medium">Selected</label>
                                <div className="flex flex-wrap gap-1 p-2 bg-gray-800 rounded-lg min-h-[44px] mb-3">
                                    {formData.technologies.length > 0 ? formData.technologies.map((techName) => (
                                        <div key={techName} className="bg-blue-500 bg-opacity-20 text-blue-200 text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-2 cursor-pointer hover:bg-opacity-30 transition" onClick={() => handleDeselectTechnology(techName)}>
                                            <span>{techName}</span>
                                            <button type="button" className="font-bold hover:text-red-300">&times;</button>
                                        </div>
                                    )) : <p className="text-gray-500 text-sm">Select or add technologies</p>}
                                </div>

                                {/* Available */}
                                <label className="block text-xs text-gray-300 mb-2 font-medium">Available</label>
                                <div className="flex flex-wrap gap-1 p-2 bg-gray-900 rounded-lg min-h-[44px] mb-3">
                                    {availableTechnologies.length > 0 ? availableTechnologies.map((tech) => (
                                        <div key={tech.id} className="bg-gray-600 hover:bg-gray-500 text-gray-100 text-sm font-semibold px-3 py-1 rounded-full cursor-pointer transition" onClick={() => handleSelectTechnology(tech.name)}>
                                            {tech.name}
                                        </div>
                                    )) : <p className="text-gray-500 text-sm">All selected</p>}
                                </div>

                                {/* Add new */}
                                <div className="flex gap-1">
                                    <input
                                        id="new-tech-input"
                                        type="text"
                                        value={newTechInput}
                                        onChange={(e) => setNewTechInput(e.target.value)}
                                        placeholder="Add new tech..."
                                        className="flex-1 px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                                    />
                                    <button type="button" onClick={handleAddNewTechnology} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold px-3 py-1 rounded-lg transition-colors text-sm">
                                        Add
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-700 bg-opacity-50 rounded-xl p-3 border border-gray-600">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-white text-sm">Project Images</h4>
                                    <button type="button" onClick={handleAddImageField} className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors">
                                        + Add Image
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {formData.images.map((url, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <input 
                                                value={url}
                                                onChange={(e) => handleImageChange(index, e.target.value)}
                                                placeholder="Paste image URL..."
                                                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                                            />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                ref={el => {fileInputRefs.current[index] = el}}
                                                onChange={(e) => onSelectFile(e, index)}
                                            />
                                            <button type="button" onClick={() => fileInputRefs.current[index]?.click()} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50" disabled={uploadingImageIndex === index}>
                                              {uploadingImageIndex === index ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                <Upload className="w-4 h-4" />
                                                )}
                                            </button>
                                            <button type="button" onClick={() => handleRemoveImage(index)} className="text-red-400 hover:text-red-300 font-semibold px-3 py-2 rounded-lg transition-colors">🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-gray-200 cursor-pointer hover:text-white transition text-sm">
                                <input type="checkbox" name="isFeatured" checked={formData.isFeatured} onChange={handleInputChange} className="w-4 h-4 rounded bg-gray-700 border border-gray-600"/>
                                <span className="font-medium">Mark as Featured Project</span>
                            </label>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-600">
                                <button type="button" onClick={closeForm} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-4 rounded-lg transition-colors text-sm">Cancel</button>
                                <button type="submit" className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-1 px-4 rounded-lg transition-all text-sm">{editingProject ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            Projects
                        </h2>
                        <p className="text-gray-400">Showcase your best work</p>
                    </div>
                    <button onClick={() => openForm()} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-lg text-sm">
                        + Add Project
                    </button>
                </div>

                {isLoading && <p className="text-gray-400">Loading...</p>}
                {error && (
                    <div className="mb-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-50 rounded-lg p-2 flex items-center gap-2">
                        <span>❌</span>
                        <p className="text-red-200 text-sm">{error}</p>
                    </div>
                )}
                
                <div className="space-y-4">
                    {projects.map(p => (
                        <div key={p.id} className="bg-gray-700 bg-opacity-50 border border-gray-600 rounded-xl p-6 hover:bg-opacity-70 transition">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xl font-bold text-white">{p.title}</h3>
                                        {p.isFeatured && <span className="text-xl"></span>}
                                    </div>
                                    <p className="text-gray-300 text-sm mb-3">{p.description}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {p.technologies?.slice(0, 3).map((tech, idx) => (
                                            <span key={idx} className="text-xs bg-blue-500 bg-opacity-20 text-blue-200 px-2 py-1 rounded-full">{tech.name}</span>
                                        ))}
                                        {p.technologies && p.technologies.length > 3 && <span className="text-xs text-gray-400">+ {p.technologies.length - 3}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-600">
                            <button
                                onClick={() => openForm(p)}
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors"
                            >
                                <Pencil size={16} />
                                Edit
                            </button>

                            <button
                                onClick={() => handleDelete(p.id)}
                                className="flex items-center gap-1 text-red-400 hover:text-red-300 font-medium text-sm transition-colors"
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                            </div>
                        </div>
                    ))}
                    {!isLoading && projects.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-400">No projects yet. Add one to get started!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectManager;
