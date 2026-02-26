import React, { useState, useEffect } from 'react';
import { Garment, EditPageData, AppConfig, Avatar } from './types';
import HomePage from './pages/HomePage';
import ARExperience from './pages/ARExperience';
import StaticImageExperience from './pages/StaticImageExperience';
import { IntroAnimation } from './components/IntroAnimation';
import SharePage from './pages/SharePage';
import EditPage from './pages/EditPage';
import { getConfig } from './config';
import { IconSpinner, IconCheck } from './components/Icons';
import DownloadPage from './pages/DownloadPage';
import DanceArena from './pages/DanceArena';

const CONFIG_NAME_KEY = 'metaCloset_activeConfigName';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configName, setConfigName] = useState<string>(() => localStorage.getItem(CONFIG_NAME_KEY) || 'pears');
  const [isIntroFinished, setIsIntroFinished] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [isModeSelectionModalOpen, setIsModeSelectionModalOpen] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  
  const [view, setView] = useState<'home' | 'ar' | 'static' | 'edit' | 'share' | 'download' | 'dance'>('home');
  const [imageForSharePage, setImageForSharePage] = useState<string | null>(null);
  const [editPageData, setEditPageData] = useState<EditPageData | null>(null);
  const [imageUrlForDownloadPage, setImageUrlForDownloadPage] = useState<string | null>(null);
  const [newConfigMessage, setNewConfigMessage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(CONFIG_NAME_KEY, configName);
  }, [configName]);

  useEffect(() => {
    const loadConfig = async () => {
        const { config: appConfig, isNew } = await getConfig(configName);
        setConfig(appConfig);
        if (isNew) {
            setNewConfigMessage(`New configuration '${configName}' created with default settings.`);
            setTimeout(() => setNewConfigMessage(null), 5000); // Auto-dismiss after 5 seconds
        }
    };
    loadConfig();
    
    // Check for download page URL via hash routing to avoid Vite server issues
    const hash = window.location.hash;
    if (hash.startsWith('#/download?')) {
        const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
        // URLSearchParams.get() automatically decodes the parameter value.
        const urlParam = params.get('url');

        if (urlParam) {
            setView('download');
            setImageUrlForDownloadPage(urlParam);
            // Clean the URL hash to avoid loops on refresh, preserving any query params
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
    }
  }, [configName]);


  const reloadAppConfig = async () => {
    setConfig(null); // Show loader
    const { config: appConfig } = await getConfig(configName);
    setConfig(appConfig);
  };

  const handleSetConfigName = (newName: string) => {
    const trimmedName = newName.trim().replace(/[^a-zA-Z0-9_-]/g, ''); // Sanitize name
    if (trimmedName && trimmedName !== configName) {
        setConfig(null); // Show loader to indicate change
        setConfigName(trimmedName);
    }
  };

  const handleSelectGarment = (garment: Garment) => {
    if (!config || !config.avatars || config.avatars.length === 0) {
        alert("Application error: No avatars are configured.");
        console.error("Configuration error: No avatars available to assign to garment.");
        return;
    }

    let avatarForGarment: Avatar | undefined;
    
    // Prioritize an avatar of the correct gender.
    if (garment.gender === 'Male') {
        avatarForGarment = config.avatars.find(a => a.gender === 'Male');
    } else { // For 'Female' or 'Unisex' garments, prefer a Female avatar.
        avatarForGarment = config.avatars.find(a => a.gender === 'Female');
    }

    // Fallback if no specific gender match is found.
    if (!avatarForGarment) {
        avatarForGarment = config.avatars[0];
    }
    
    setSelectedAvatar(avatarForGarment);
    setSelectedGarment(garment);
    setIsModeSelectionModalOpen(true);
  };

  const handleStartLive = () => {
    if (selectedGarment) {
      setView('ar');
      setIsModeSelectionModalOpen(false);
    }
  };

  const handleImageSelected = (imageUrl: string) => {
    if (selectedGarment) {
      setUploadedImageUrl(imageUrl);
      setView('static');
      setIsModeSelectionModalOpen(false);
    }
  };

  const handleGoHome = () => {
    setSelectedGarment(null);
    setIsModeSelectionModalOpen(false);
    setView('home');
    setImageForSharePage(null);
    setEditPageData(null);
    if (uploadedImageUrl) {
        URL.revokeObjectURL(uploadedImageUrl);
    }
    setUploadedImageUrl(null);
    setImageUrlForDownloadPage(null);
  };
  
  const handleIntroFinished = () => {
    setIsIntroFinished(true);
  };

  const handleNavigateToEdit = (data: EditPageData) => {
    setEditPageData(data);
    setView('edit');
  };

  const handleNavigateToShare = (imageDataUrl: string) => {
    setEditPageData(null); // Clear edit data
    setImageForSharePage(imageDataUrl);
    setView('share');
  };

  const handleNavigateToDev = () => {
    setView('dev');
  };

  const handleNavigateToDanceArena = () => {
    setView('dance');
  };

  if (!config) {
    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#010101]">
            <IconSpinner className="w-16 h-16 animate-spin text-lime-400" />
            <p className="mt-4 text-zinc-300 font-semibold">Initializing MetaCloset ({configName})...</p>
        </div>
    );
  }

  if (!isIntroFinished) {
    return <IntroAnimation onFinished={handleIntroFinished} config={config} />;
  }

  const renderView = () => {
    switch(view) {
      case 'ar':
        if (selectedGarment && selectedAvatar) {
          return <ARExperience 
                    garment={selectedGarment} 
                    avatar={selectedAvatar} 
                    onGoHome={handleGoHome} 
                    onNavigateToEdit={handleNavigateToEdit}
                    config={config}
                    currentUser={null}
                    onRequestLogin={() => {}}
                 />;
        }
        return null; // Should not happen in normal flow

      case 'static':
        if (selectedGarment && uploadedImageUrl && selectedAvatar) {
          return <StaticImageExperience 
                    garment={selectedGarment} 
                    avatar={selectedAvatar} 
                    imageUrl={uploadedImageUrl} 
                    onGoHome={handleGoHome} 
                    config={config}
                    currentUser={null}
                    onRequestLogin={() => {}}
                 />;
        }
        return null;
      
      case 'edit':
        if (editPageData) {
          return <EditPage 
                    data={editPageData}
                    config={config}
                    onComplete={handleNavigateToShare}
                    onGoHome={handleGoHome}
                 />;
        }
        handleGoHome(); // If no data, go home
        return null;

      case 'share':
        if (imageForSharePage) {
          return <SharePage capturedImage={imageForSharePage} onGoHome={handleGoHome} config={config} configName={configName} />;
        }
        // If there's no image, just go home.
        handleGoHome();
        return null;
      
      case 'download':
        if (imageUrlForDownloadPage) {
            return <DownloadPage imageUrl={imageUrlForDownloadPage} onGoHome={handleGoHome} />;
        }
        handleGoHome();
        return null;
      
      case 'dance':
        return <DanceArena config={config} onGoHome={handleGoHome} />;

      case 'home':
      default:
        return (
          <HomePage 
            config={config}
            onSelectGarment={handleSelectGarment}
            selectedGarment={selectedGarment}
            isModeSelectionModalOpen={isModeSelectionModalOpen}
            onCloseModeSelectionModal={() => setIsModeSelectionModalOpen(false)}
            onStartLive={handleStartLive}
            onImageSelected={handleImageSelected}
            onNavigateToDanceArena={handleNavigateToDanceArena}
          />
        );
    }
  };
  
  return (
    <div className="w-full min-h-screen relative">
      {renderView()}
      {newConfigMessage && (
          <div className="absolute top-5 right-5 z-[1000] bg-green-600/90 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-lg shadow-lg animate-fade-in-down flex items-center space-x-3">
              <IconCheck className="w-6 h-6" />
              <p>{newConfigMessage}</p>
          </div>
      )}
    </div>
  );
}
