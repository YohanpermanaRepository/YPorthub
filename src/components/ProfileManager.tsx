import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ProfileData } from '../types';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { API_BASE_URL } from '../config';
import { Loader2 } from "lucide-react";

import { 
  User, 
  Scissors, 
  XCircle, 
  CheckCircle, 
  Upload, 
  Save 
} from "lucide-react";

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
                const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
                resolve(file);
            },
            'image/jpeg',
            0.95 // quality
        );
    });
}


const ProfileManager: React.FC = () => {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for image cropping
    const [upImg, setUpImg] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);

    const fetchProfile = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/profile`);
            if (!response.ok) throw new Error('Failed to fetch profile data');
            setProfile(await response.json());
        } catch (err) { setError((err as Error).message); } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!profile) return;
        const { name, value } = e.target;
        setProfile({ ...profile, [name]: value });
    };

    // This function is now only called with the final (potentially cropped) file
    const handleImageUpload = async (file: File) => {
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        setIsUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Upload failed');
            
            if (profile) {
                setProfile({...profile, profileImage: data.url});
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsUploading(false);
        }
    };

    // When a file is selected, open the cropping modal AFTER the image is loaded
    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined); // Reset crop state
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setUpImg(reader.result?.toString() || '');
                setIsCropModalOpen(true); // Open modal only after image is loaded into state
            });
            reader.readAsDataURL(e.target.files[0]);
            // Clear the input value to allow selecting the same file again
            e.target.value = '';
        }
    };
    
    // Set initial crop area when image loads in the cropper
    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
            width,
            height
        );
        setCrop(initialCrop);
    }

    // Handler for the "Crop & Upload" button in the modal
    const handleCropAndUpload = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current) {
            try {
                const croppedFile = await getCroppedImg(imgRef.current, completedCrop);
                await handleImageUpload(croppedFile);
                setIsCropModalOpen(false);
                setUpImg('');
            } catch (e) {
                console.error(e);
                setError("Could not crop the image. Please try again.");
            }
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setError(null); setSuccess(null);
        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        try {
            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(profile)
            });
            if (!response.ok) throw new Error('Failed to update profile');
            setSuccess("Profile updated successfully!");
        } catch (err) { setError((err as Error).message); }
    };

   if (isLoading) {
    return (
        <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
    );
    }

    return (
        <div>
            {isCropModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
                        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Scissors className="w-5 h-5" />
                            Crop Your Profile Picture
                        </h3>
                        {upImg && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                                keepSelection
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop me"
                                    src={upImg}
                                    onLoad={onImageLoad}
                                    className="max-h-[60vh] rounded-lg"
                                />
                            </ReactCrop>
                        )}
                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                type="button" 
                                onClick={() => { setIsCropModalOpen(false); setUpImg(''); }} 
                                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleCropAndUpload} 
                                className="bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-all disabled:opacity-50" 
                                disabled={!completedCrop?.width || isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Crop & Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-8">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                        <User className="w-6 h-6" />
                        Manage Profile
                    </h2>
                    <p className="text-gray-400">Update your profile information and picture</p>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="mb-6 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-50 rounded-lg p-4 flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-red-400" />
                        <p className="text-red-200">{error}</p>
                    </div>
                )}
                {success && (
                    <div className="mb-6 bg-emerald-500 bg-opacity-10 border border-emerald-500 border-opacity-50 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <p className="text-emerald-200">{success}</p>
                    </div>
                )}
                
                {profile && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold text-gray-200 mb-3">Full Name</label>
                            <input 
                                id="name" 
                                name="name" 
                                value={profile.name} 
                                onChange={handleInputChange} 
                                required 
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition"
                                placeholder="Enter your full name"
                            />
                        </div>

                        {/* Profile Image Section */}
                        <div className="bg-gray-700 bg-opacity-50 rounded-xl p-6 border border-gray-600">
                            <label className="block text-sm font-semibold text-gray-200 mb-4">Profile Picture</label>
                            <div className="flex items-center gap-6">
                                {profile.profileImage && (
                                    <div className="flex-shrink-0">
                                        <img 
                                            src={profile.profileImage} 
                                            alt="Profile" 
                                            className="w-24 h-24 rounded-full object-cover border-2 border-navy-500 shadow-lg"
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-4">
                                        <input 
                                            id="profileImage" 
                                            name="profileImage" 
                                            value={profile.profileImage} 
                                            onChange={handleInputChange} 
                                            required 
                                            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition text-sm"
                                            placeholder="Enter image URL"
                                        />
                                        <input 
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            ref={fileInputRef}
                                            onChange={onSelectFile}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className="bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap" 
                                            disabled={isUploading}
                                        >
                                            {isUploading ? 'Uploading...' : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                Upload
                                            </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400">Click upload to select an image from your device</p>
                                </div>
                            </div>
                        </div>

                        {/* Description Field */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-semibold text-gray-200 mb-3">Bio / Description</label>
                            <textarea 
                                id="description" 
                                name="description" 
                                value={profile.description} 
                                onChange={handleInputChange} 
                                required 
                                rows={5} 
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 transition resize-none"
                                placeholder="Write a brief description about yourself..."
                            />
                            <p className="text-xs text-gray-400 mt-2">{profile.description.length}/500 characters</p>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-600">
                            <button 
                                type="submit" 
                                className="bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ProfileManager;
