import React from 'react';

const Header: React.FC = () => {
    return (
        <header className="w-full p-4 z-20 absolute top-0 left-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between glassmorphic rounded-xl p-2 px-4">
                <a href="/" className="text-2xl font-black uppercase text-white">
                    Meta<span className="text-lime-400">Closet</span>
                </a>
                <nav className="hidden md:flex items-center space-x-6">
                    <a href="#" className="text-zinc-300 hover:text-white transition-colors font-semibold">Wardrobe</a>
                    <a href="#" className="text-zinc-300 hover:text-white transition-colors font-semibold">Studio</a>
                    <a href="#" className="text-zinc-300 hover:text-white transition-colors font-semibold">About</a>
                    <a href="#" className="text-zinc-300 hover:text-white transition-colors font-semibold">Careers</a>
                </nav>
            </div>
        </header>
    );
};

export default Header;
