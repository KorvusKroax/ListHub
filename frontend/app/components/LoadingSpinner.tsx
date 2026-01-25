'use client';

type LoadingSpinnerProps = {
  size?: 'small' | 'medium' | 'large';
  color?: string;
};

export default function LoadingSpinner(props: LoadingSpinnerProps) {
  const sizeClass = {
    small: 'h-6 w-6',
    medium: 'h-12 w-12',
    large: 'h-24 w-24',
  }[props.size || 'medium'];

  return (
    <svg className={`animate-spin ${sizeClass} text-${props.color || 'gray-600'} mx-auto`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="15.7 47.1"></circle>
    </svg>
  );
}
