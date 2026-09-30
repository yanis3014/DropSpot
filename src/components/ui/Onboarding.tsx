'use client';

import { useState } from 'react';
import { Laptop, Sneaker, MusicNotes, Coffee } from '@phosphor-icons/react';

interface OnboardingProps {
  onComplete: () => void;
}

const preferences = [
  { id: 'bosser', label: 'Bosser', icon: Laptop, color: 'text-brand-espresso' },
  { id: 'evenements', label: 'Événements', icon: Sneaker, color: 'text-brand-terracotta' },
  { id: 'chill', label: 'Chill & DJ', icon: MusicNotes, color: 'text-brand-mocha' },
  { id: 'brunch', label: 'Brunch', icon: Coffee, color: 'text-brand-matcha' },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [selectedPreference, setSelectedPreference] = useState<string | null>(null);

  const handlePreferenceSelect = (preference: string) => {
    setSelectedPreference(preference);
    localStorage.setItem('dropspot_preference', preference);
    
    // Add 300ms delay for smooth exit animation
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-brand-oat z-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full flex flex-col items-center">
        <h1 className="text-4xl font-extrabold text-brand-espresso text-center tracking-tight">
          Salut Nice 👋
        </h1>
        <p className="text-lg text-brand-mocha text-center mt-2 mb-8">
          Trouve ton prochain spot.
        </p>

        <div className="grid grid-cols-2 gap-4 w-full max-w-xs mx-auto">
          {preferences.map((pref) => {
            const Icon = pref.icon;
            const isSelected = selectedPreference === pref.id;
            
            return (
              <button
                key={pref.id}
                onClick={() => handlePreferenceSelect(pref.id)}
                disabled={selectedPreference !== null}
                className={`aspect-square bg-white rounded-2xl shadow-sm border-2 flex flex-col items-center justify-center transition-all duration-200 ease-in-out active:scale-95 ${
                  isSelected 
                    ? 'border-brand-matcha bg-brand-matcha/5' 
                    : 'border-transparent hover:shadow-md'
                } ${selectedPreference !== null && !isSelected ? 'opacity-50' : ''}`}
              >
                <Icon size={42} weight="duotone" className={pref.color} />
                <span className="text-sm font-semibold mt-3 text-brand-espresso">{pref.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
