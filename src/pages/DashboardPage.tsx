import React, { useState } from 'react';
import ExperienceManager from '../components/ExperienceManager';
import ProjectManager from '../components/ProjectManager';
import EducationManager from '../components/EducationManager';
import CertificationManager from '../components/CertificationManager';
import ProfileManager from '../components/ProfileManager';
import AboutManager from '../components/AboutManager';
import ContactManager from '../components/ContactManager';
import AccountManager from '../components/AccountManager';
import TechnologyManager from '../components/TechnologyManager';

import { User, FileText, Phone, Briefcase, Folder, GraduationCap, Award, Settings } from "lucide-react";

interface DashboardPageProps {
  onLogout: () => void;
  authInfo: { username: string; role: string } | null;
}

type ManagedSection = 'Profile' | 'About' | 'Contact' | 'Experience' | 'Projects' | 'Education' | 'Certifications' | 'Technologies' | 'Account Settings';

const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout, authInfo }) => {
  const [activeSection, setActiveSection] = useState<ManagedSection>('Profile');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const username = authInfo?.username || 'there';
  const role = authInfo?.role || 'unknown';
  const isReadOnly = role !== 'admin';

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'Profile': return <ProfileManager />;
      case 'About': return <AboutManager />;
      case 'Contact': return <ContactManager />;
      case 'Experience': return <ExperienceManager />;
      case 'Projects': return <ProjectManager />;
      case 'Education': return <EducationManager />;
      case 'Certifications': return <CertificationManager />;
      case 'Technologies': return <TechnologyManager />;
      case 'Account Settings': return <AccountManager />;
      default: return <ProfileManager />;
    }
  };

  const navItems: Array<{ name: ManagedSection; icon: React.ReactNode }> = [
  { name: 'Profile', icon: <User className="w-5 h-5" /> },
  { name: 'About', icon: <FileText className="w-5 h-5" /> },
  { name: 'Contact', icon: <Phone className="w-5 h-5" /> },
  { name: 'Experience', icon: <Briefcase className="w-5 h-5" /> },
  { name: 'Projects', icon: <Folder className="w-5 h-5" /> },
  { name: 'Education', icon: <GraduationCap className="w-5 h-5" /> },
  { name: 'Certifications', icon: <Award className="w-5 h-5" /> },
  { name: 'Technologies', icon: <Settings className="w-5 h-5" /> },
];

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700 flex flex-col transition-all duration-300 shadow-2xl`}>
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className={`${sidebarOpen ? 'flex items-center gap-3' : 'justify-center w-full'}`}>
              <div className="w-10 h-10 bg-gradient-to-br from-navy-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">Y</span>
              </div>
{sidebarOpen && (
  <h1 className="text-xl font-bold text-white">
    YPorthub
  </h1>
)}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {sidebarOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
          {sidebarOpen && (
            <div className="text-sm text-gray-400">
              <p className="font-medium text-white">Welcome, {username}!</p>
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 mt-2 bg-amber-500 bg-opacity-20 border border-amber-500 border-opacity-30 px-3 py-1 rounded-full text-xs font-medium text-amber-200">
                  <span>🔒</span>
                  Read-only
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          {navItems.map(item => (
            <button
              key={item.name}
              onClick={() => setActiveSection(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              activeSection === item.name
              ? "bg-gray-600 text-white shadow-lg"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
              title={item.name}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <span className="text-sm font-medium truncate">{item.name}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t border-gray-700 space-y-2 ${!sidebarOpen && 'flex flex-col items-center'}`}>
          <button
            onClick={() => setActiveSection('Account Settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200 ${!sidebarOpen && 'justify-center'}`}
            title="Account Settings"
          >
            <span className="text-xl flex-shrink-0">⚙️</span>
            {sidebarOpen && <span className="text-sm font-medium">Settings</span>}
          </button>
          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-red-500 hover:bg-opacity-20 hover:text-red-400 transition-all duration-200 ${!sidebarOpen && 'justify-center'}`}
            title="Logout"
          >
            <span className="text-xl flex-shrink-0">🚪</span>
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-gradient-to-r from-gray-800 to-gray-800 border-b border-gray-700 px-8 py-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">{activeSection}</h2>
              <p className="text-gray-400 text-sm mt-1">Manage your portfolio content</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-medium">{username}</p>
                <p className="text-gray-400 text-sm capitalize">{role} Account</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-navy-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {username.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-950">
          <div className="container mx-auto px-8 py-8">
            <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
              {renderActiveSection()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
