import React, { FC, useRef, useEffect, useState, useMemo } from 'react';
import { Garment, AppConfig } from '../types';
import Header from '../components/Header';
import { ModeSelectionModal } from '../components/ModeSelectionModal';
import CatalogCard from '../components/CatalogCard';
import { IconSearch, IconUsers } from '../components/Icons';

interface HomePageProps {
  config: AppConfig;
  onSelectGarment: (garment: Garment) => void;
  selectedGarment: Garment | null;
  isModeSelectionModalOpen: boolean;
  onCloseModeSelectionModal: () => void;
  onStartLive: () => void;
  onImageSelected: (imageUrl: string) => void;
  onNavigateToDanceArena: () => void;
}

const AnimatedBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
  
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
  
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
  
      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);
  
      let particles: Particle[] = [];
      const particleCount = 50;
  
      class Particle {
        x: number;
        y: number;
        size: number;
        speedX: number;
        speedY: number;
  
        constructor() {
          this.x = Math.random() * width;
          this.y = Math.random() * height;
          this.size = Math.random() * 2 + 0.5;
          this.speedX = Math.random() * 0.5 - 0.25;
          this.speedY = Math.random() * 0.5 - 0.25;
        }
  
        update() {
          this.x += this.speedX;
          this.y += this.speedY;
  
          if (this.x > width || this.x < 0) this.x = Math.random() * width;
          if (this.y > height || this.y < 0) this.y = Math.random() * height;
        }
  
        draw() {
          if (!ctx) return;
          ctx.fillStyle = 'rgba(163, 230, 53, 0.4)';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
  
      function init() {
        particles = [];
        for (let i = 0; i < particleCount; i++) {
          particles.push(new Particle());
        }
      }
  
      let animationFrameId: number;
      function animate() {
          if (!ctx) return;
          ctx.clearRect(0, 0, width, height);
          for (const particle of particles) {
              particle.update();
              particle.draw();
          }
          animationFrameId = requestAnimationFrame(animate);
      }
  
      const handleResize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        init();
      };
  
      window.addEventListener('resize', handleResize);
      
      init();
      animate();
  
      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
      };
    }, []);
  
    return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10" />;
};


const HomePage: FC<HomePageProps> = ({ 
  config,
  onSelectGarment, 
  selectedGarment,
  isModeSelectionModalOpen,
  onCloseModeSelectionModal,
  onStartLive,
  onImageSelected,
  onNavigateToDanceArena,
}) => {
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const categories = useMemo(() => {
        const allCategories = config.garments.map(g => g.category || 'Uncategorized');
        return ['All', ...Array.from(new Set(allCategories))];
    }, [config.garments]);

    const filteredGarments = useMemo(() => {
        return config.garments.filter(garment => {
            const categoryMatch = activeCategory === 'All' || (garment.category || 'Uncategorized') === activeCategory;
            const searchMatch = garment.name.toLowerCase().includes(searchQuery.toLowerCase());
            return categoryMatch && searchMatch;
        });
    }, [config.garments, activeCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-black flex flex-col relative isolate overflow-hidden animate-page-fade-in">
      <AnimatedBackground />
      <Header />
      
      <main className="flex-grow flex flex-col items-center text-center px-4 py-8 z-10">
        <div className="w-full max-w-5xl mx-auto text-center animate-fade-in-up flex flex-col items-center justify-center min-h-[60vh] pt-24" style={{ animationDelay: '300ms' }}>
            <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-wider">
                Your Personal<br />
                <span className="text-lime-400" style={{ textShadow: '0 0 15px var(--color-primary-glow)' }}>
                    Digital Wardrobe
                </span>
            </h1>
            <p className="mt-6 text-lg text-zinc-300 max-w-2xl mx-auto">
                Step into the future. Try on exclusive digital garments in real-time with our cutting-edge AR technology, or lead your own dance crew in the Arena.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="#catalog" className="btn-primary px-8 py-3 text-lg">
                    Explore Collection
                </a>
                <button onClick={onNavigateToDanceArena} className="btn-secondary px-8 py-3 text-lg flex items-center space-x-2">
                    <IconUsers className="w-6 h-6" />
                    <span>Enter Dance Arena</span>
                </button>
            </div>
        </div>

        <div id="catalog" className="w-full max-w-7xl mx-auto pt-24 pb-12">
            <h2 className="text-4xl font-bold text-white mb-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>Explore The Collection</h2>
            
             {/* Filter Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center mb-8 p-4 glassmorphic rounded-xl animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                {/* Search */}
                <div className="relative w-full md:w-auto md:flex-1">
                    <input 
                        type="text"
                        placeholder="Search collection..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder-zinc-400 focus:ring-2 focus:ring-lime-400 focus:outline-none"
                    />
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                </div>
            </div>

            {/* Categories */}
            <div className="flex items-center justify-center flex-wrap gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '550ms' }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 border-2 ${activeCategory === cat ? 'bg-lime-400 text-black border-lime-400' : 'bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>


            {/* Garment Grid */}
            {filteredGarments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                    {filteredGarments.map(garment => (
                        <CatalogCard key={garment.id} garment={garment} onSelect={onSelectGarment} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 animate-fade-in-up glassmorphic rounded-xl" style={{ animationDelay: '600ms' }}>
                    <p className="text-zinc-400 text-lg font-semibold">No garments match your filters.</p>
                    <p className="text-zinc-500 mt-2">Try adjusting your search or category selection.</p>
                </div>
            )}
        </div>
      </main>

      <footer className="text-center py-6 text-zinc-500 z-10 relative">
        <p>&copy; 2024 MetaCloset. All rights reserved.</p>
      </footer>

      {selectedGarment && (
        <ModeSelectionModal
          isOpen={isModeSelectionModalOpen}
          onClose={onCloseModeSelectionModal}
          garment={selectedGarment}
          onStartLive={onStartLive}
          onImageSelected={onImageSelected}
        />
      )}
    </div>
  );
};

export default HomePage;
