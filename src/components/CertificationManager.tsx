import React, { useState, useEffect, useCallback } from 'react';
import type { Certification } from '../types';
import { API_BASE_URL } from '../config';
import { Loader2, Plus, Pencil, Trash2, Award } from "lucide-react";

const initialFormData: Omit<Certification, 'id'> = {
  category: '',
  name: '',
  issuer: '',
  year: new Date().getFullYear(),
  link: ''
};

const CertificationManager: React.FC = () => {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [formData, setFormData] = useState<Omit<Certification, 'id'>>(initialFormData);

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

  useEffect(() => {
    if (editingCert) setFormData(editingCert);
    else setFormData(initialFormData);
  }, [editingCert]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'number'
        ? parseInt(value) || new Date().getFullYear()
        : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = localStorage.getItem('authToken');
    if (!token) return setError("Authentication error.");

    const method = editingCert ? 'PUT' : 'POST';
    const url = editingCert
      ? `${API_BASE_URL}/certifications/${editingCert.id}`
      : `${API_BASE_URL}/certifications`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`Failed to ${editingCert ? 'update' : 'create'} certification`);
      }

      await fetchCerts();
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

  const openForm = (cert: Certification | null = null) => {
    setEditingCert(cert);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditingCert(null);
    setIsFormOpen(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Award className="w-6 h-6" />
          Manage Certifications
        </h2>

        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-200 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700">

            <h3 className="text-xl font-bold text-white mb-4">
              {editingCert ? 'Edit' : 'Add'} Certification
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">

              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Certification Name"
                required
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              />

              <input
                name="issuer"
                value={formData.issuer}
                onChange={handleInputChange}
                placeholder="Issuer"
                required
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              />

              <input
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Category"
                required
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              />

              <input
                name="year"
                type="number"
                value={formData.year}
                onChange={handleInputChange}
                placeholder="Year"
                required
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              />

              <input
                name="link"
                value={formData.link}
                onChange={handleInputChange}
                placeholder="Certificate Link"
                required
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              />

              <div className="flex justify-end gap-3 pt-4">

                <button
                  type="button"
                  onClick={closeForm}
                  className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="bg-gradient-to-r from-navy-500 to-indigo-600 hover:from-navy-600 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  {editingCert ? 'Update' : 'Save'}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* Certification List */}
      <div className="space-y-4">

        {certifications.map(cert => (
          <div
            key={cert.id}
            className="p-4 bg-gray-700 border border-gray-600 rounded-xl flex justify-between items-center"
          >

            <div>
              <p className="font-semibold text-white">{cert.name}</p>
              <p className="text-sm text-gray-400">
                {cert.issuer} • {cert.year}
              </p>
            </div>

            <div className="flex gap-4">

              <button
                onClick={() => openForm(cert)}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>

              <button
                onClick={() => handleDelete(cert.id)}
                className="flex items-center gap-1 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
};

export default CertificationManager;