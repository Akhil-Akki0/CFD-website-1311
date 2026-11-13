import React, { useRef, useEffect, useState } from 'react';

export type VideoBackgroundMode = 'frozen_alien_planet' | 'blackhole' | 'rocket';

export interface AerospaceVideoBackgroundProps {
  className?: string;
  theme?: 'light' | 'dark';
  lightTheme?: string;
  overlayOpacity?: number;
  activeVideo?: VideoBackgroundMode;
}

export const AerospaceVideoBackground: React.FC<AerospaceVideoBackgroundProps> = ({
  className = '',
  activeVideo: initialVideo = 'frozen_alien_planet',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeVideo] = useState<VideoBackgroundMode>(initialVideo);
  const [hasLoaded, setHasLoaded] = useState(false);

  const currentVideoSrc =
    activeVideo === 'frozen_alien_planet'
      ? '/media/frozen_alien_planet_4k_crystal.mp4'
      : activeVideo === 'blackhole'
      ? '/media/black_hole_4k.mp4'
      : '/media/metallic-rocket-4k.mp4';

  const currentPoster =
    activeVideo === 'frozen_alien_planet'
      ? '/media/frozen_alien_planet_4k_poster.jpg'
      : activeVideo === 'blackhole'
      ? '/media/black_hole_loop_poster.jpg'
      : '/media/loading-poster.jpg';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasLoaded(false);

    // Browser autoplay policy requires muted
    video.muted = true;
    video.defaultMuted = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }, [activeVideo]);

  // Hardware-accelerated presentation: Avoid real-time CSS filters on 4K video
  // to eliminate GPU compositor drops and frame shudder.
  const videoClasses = 'opacity-95';
  const vignetteOpacity = 0.25;

  return (
    <div
      className={`fixed inset-0 h-full w-full overflow-hidden pointer-events-none select-none z-0 bg-slate-950 ${className}`}
      aria-hidden="true"
    >
      {/* Underlying poster fallback */}
      <img
        src={currentPoster}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          hasLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Main Looping Crystal 4K Alien Planet / Rocket Video */}
      <video
        key={currentVideoSrc}
        ref={videoRef}
        src={currentVideoSrc}
        poster={currentPoster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedData={() => setHasLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover object-center ${videoClasses}`}
      />

      {/* Subtle Cinematic Vignette - Preserves 100% Video Crispness & Cosmic Clarity */}
      <div
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.0) 45%, rgba(15, 23, 42, 0.15) 80%, rgba(15, 23, 42, 0.35) 100%)',
          opacity: vignetteOpacity,
        }}
      />
    </div>
  );
};
