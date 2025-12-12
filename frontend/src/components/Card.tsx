import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
    return (
        <div
            className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 transition-all duration-300 ${onClick ? 'cursor-pointer hover:bg-white/10 hover:scale-[1.01] hover:shadow-xl hover:border-white/20' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
