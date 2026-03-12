import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AboutData } from '../types';
import ReactCrop, { type Crop, type PixelCrop, centerCrop } from 'react-image-crop';
import { API_BASE_URL } from '../config';

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
                const file = new File([blob], 'about-image.jpg', { type: 'image/jpeg' });
                resolve(file);
            },
            'image/jpeg',
            0.95
        );
    });
}

const AboutManager: React.FC = () => {
    const [about, setAbout] = useState<AboutData>({ description: '', images: []});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [upImg, setUpImg] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [croppingImageIndex, setCroppingImageIndex] = useState<number | null>(null);

    const fetchAbout = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/about`);
            if (!response.ok) throw new Error('Failed to fetch about data');
            setAbout(await response.json());
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAbout();
    }, [fetchAbout]);

    const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAbout(prev => ({ ...prev, description: e.target.value }));
    };

    const handleImageChange = (index: number, value: string) => {
        const newImages = [...about.images];
        newImages[index] = value;
        setAbout(prev => ({ ...prev, images: newImages }));
    };

    const handleAddImageField = () => {
        setAbout(prev => ({ ...prev, images: [...prev.images, ''] }));
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setAbout(prev => ({
            ...prev,
            images: prev.images.filter((_, index) => index !== indexToRemove)
        }));
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
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: uploadFormData
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

    const onSelectFileForCrop = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined);
            setCroppingImageIndex(index);

            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setUpImg(reader.result?.toString() || '');
                setIsCropModalOpen(true);
            });

            reader.readAsDataURL(e.target.files[0]);
            e.target.value = '';
        }
    };

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;

        const initialCrop = centerCrop(
            { unit: '%', width: 90, height: 90, x: 0, y: 0 },
            width,
            height
        );

        setCrop(initialCrop);
    }

    const handleCropAndUpload = async () => {
        if (
            completedCrop?.width &&
            completedCrop?.height &&
            imgRef.current &&
            croppingImageIndex !== null
        ) {
            try {
                const croppedFile = await getCroppedImg(imgRef.current, completedCrop);
                await handleImageUpload(croppedFile, croppingImageIndex);

                setIsCropModalOpen(false);
                setUpImg('');
                setCroppingImageIndex(null);

            } catch (e) {
                console.error(e);
                setError("Could not crop the image.");
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setError(null);
        setSuccess(null);

        const token = localStorage.getItem('authToken');
        if (!token) return setError("Authentication error.");

        const finalData = {
            ...about,
            images: about.images.filter(img => img.trim() !== '')
        };

        try {
            const response = await fetch(`${API_BASE_URL}/about`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(finalData)
            });

            if (!response.ok) throw new Error('Failed to update about section');

            setSuccess("About section updated successfully!");

        } catch (err) {
            setError((err as Error).message);
        }
    };

    if (fileInputRefs.current.length !== about.images.length) {
        fileInputRefs.current.length = about.images.length;
    }

    if (isLoading) return <p className="text-white">Loading about data...</p>;

    return (
        <div className="bg-navy-900 text-white p-8 rounded-lg shadow">

            {isCropModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-[100] p-4">

                    <div className="bg-navy-900 text-white p-6 rounded-lg shadow-xl w-full max-w-2xl">

                        <h3 className="text-xl font-bold mb-4">
                            Crop 'About Me' Image
                        </h3>

                        {upImg && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                keepSelection
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop me"
                                    src={upImg}
                                    onLoad={onImageLoad}
                                    className="max-h-[60vh]"
                                />
                            </ReactCrop>
                        )}

                        <div className="flex justify-end gap-4 mt-4">

                            <button
                                type="button"
                                onClick={() => {
                                    setIsCropModalOpen(false);
                                    setUpImg('');
                                }}
                                className="bg-navy-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-navy-600"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleCropAndUpload}
                                className="bg-navy-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-navy-600"
                                disabled={!completedCrop?.width || uploadingImageIndex !== null}
                            >
                                {uploadingImageIndex !== null ? 'Uploading...' : 'Crop & Upload'}
                            </button>

                        </div>
                    </div>
                </div>
            )}

            <h2 className="text-2xl font-bold mb-6">
                Manage About Section
            </h2>

            {error && (
                <p className="text-red-400 bg-red-900 p-3 rounded-md my-4">
                    {error}
                </p>
            )}

            {success && (
                <p className="text-green-400 bg-green-900 p-3 rounded-md my-4">
                    {success}
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                <div>
                    <label className="block text-sm font-medium">
                        Description
                    </label>
<textarea
    value={about.description}
    onChange={handleDescChange}
    rows={6}
    className="mt-1 block w-full p-2 border border-gray-300 bg-white text-black rounded-md"
/>
                </div>

                <div>

                    <label className="block text-sm font-medium mb-1">
                        Image URLs
                    </label>

                    <div className="space-y-2">

                        {about.images.map((url, index) => (

                            <div key={index} className="flex gap-2 items-center">

                                <input
                                    value={url}
                                    onChange={(e) =>
                                        handleImageChange(index, e.target.value)
                                    }
                                    placeholder="Paste URL or upload"
                                    className="w-full p-2 border border-gray-300 bg-white text-black rounded"
                                />

                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={el => {
                                        fileInputRefs.current[index] = el
                                    }}
                                    onChange={(e) =>
                                        onSelectFileForCrop(e, index)
                                    }
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        fileInputRefs.current[index]?.click()
                                    }
                                    className="text-sm bg-navy-700 text-white font-semibold px-3 py-2 rounded-lg hover:bg-navy-600"
                                >
                                    Upload
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage(index)}
                                    className="text-red-400 font-semibold px-3 py-2 rounded-lg hover:bg-red-900"
                                >
                                    &times;
                                </button>

                            </div>
                        ))}

                    </div>

                    <button
                        type="button"
                        onClick={handleAddImageField}
                        className="text-sm font-semibold mt-2 text-navy-300 hover:text-white"
                    >
                        + Add Image URL
                    </button>

                </div>

                <div className="text-right">

                    <button
                        type="submit"
                        className="bg-navy-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-navy-600"
                    >
                        Save Changes
                    </button>

                </div>

            </form>

        </div>
    );
};

export default AboutManager;