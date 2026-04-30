import React from 'react';
import logoSrc from '@/assets/paypill-logo.png';

export default function BrandLogo({ className = 'h-10 w-auto', alt = 'PayPill' }) {
	return <img src={logoSrc} alt={alt} className={className} />;
}
