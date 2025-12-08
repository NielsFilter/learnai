import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
