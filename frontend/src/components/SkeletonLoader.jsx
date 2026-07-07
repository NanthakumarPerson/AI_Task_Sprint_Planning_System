// src/components/SkeletonLoader.jsx
export default function SkeletonLoader({ count = 3, height = 24, style = {} }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', ...style }}>
            {Array.from({ length: count }).map((_, i) => (
                <div 
                    key={i} 
                    className="skeleton" 
                    style={{ 
                        height: `${height}px`, 
                        width: `${Math.max(60, 100 - (i * 15))}%`,
                        borderRadius: 'var(--radius-sm)'
                    }} 
                />
            ))}
        </div>
    );
}
