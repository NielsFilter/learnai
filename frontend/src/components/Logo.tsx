import React from 'react';
import { Sparkles } from 'lucide-react';

interface LogoProps {
    variant?: 'small' | 'large';
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'small', className = '' }) => {
    const isLarge = variant === 'large';

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`
                flex items-center justify-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/20
                ${isLarge ? 'p-3' : 'p-2'}
            `}>
                <Sparkles className={`text-cyan-400 ${isLarge ? 'w-8 h-8' : 'w-5 h-5'}`} />
            </div>
            <span className={`font-bold tracking-tight text-white ${isLarge ? 'text-4xl' : 'text-xl'}`}>
                MnemonIQ
            </span>
        </div>
    );
};
