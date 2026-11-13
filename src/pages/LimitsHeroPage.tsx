import React, { useEffect, useRef, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { sound } from '../utils/soundEffects';

const CLOUD_VIDEO_URL =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/175fbbcd-e50a-480c-bab2-ca16d4678322.mp4';
const CLOUD_POSTER_URL =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/726b168c-da47-4682-a255-cc3e02f89bae.jpg';
const LOCAL_FALLBACK_VIDEO = '/media/black_hole_4k.mp4';

export const LimitsHeroPage: React.FC = () => {
  const { setPage } = usePlatform();

  const [videoSrc, setVideoSrc] = useState<string>(CLOUD_VIDEO_URL);
  const [isBeyondAnimating, setIsBeyondAnimating] = useState(false);
  const [isVanished, setIsVanished] = useState(false);
  const [isWavesActive, setIsWavesActive] = useState(true);

  const heroContainerRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const pillOverlayRef = useRef<HTMLDivElement | null>(null);
  const pillVideoRef = useRef<HTMLVideoElement | null>(null);
  const iconLeftRef = useRef<HTMLDivElement | null>(null);
  const speakerBtnRef = useRef<HTMLButtonElement | null>(null);
  const bgLayerRef = useRef<HTMLDivElement | null>(null);
  const watermarkGoRef = useRef<HTMLDivElement | null>(null);
  const btnBeyondRef = useRef<HTMLButtonElement | null>(null);
  const btnReturnRef = useRef<HTMLButtonElement | null>(null);

  const animationsRef = useRef<Animation[]>([]);
  const primaryAnimRef = useRef<Animation | null>(null);
  const autoResetTimerRef = useRef<any>(null);

  const DURATION = 2100; // 2.1 s

  const getFs = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw <= 720) {
      return Math.min(vw * 0.28, vh * 0.14);
    }
    return Math.min(vh * 0.18, vw * 0.108);
  };

  const isPhone = () => window.innerWidth <= 720;

  // Build the Web Animations timeline
  const buildAnimations = () => {
    animationsRef.current.forEach((a) => {
      try {
        a.cancel();
      } catch {}
    });
    animationsRef.current = [];

    const fs = getFs();
    const phone = isPhone();
    const pill = pillRef.current;
    const heroContainer = heroContainerRef.current;
    const pillOverlay = pillOverlayRef.current;
    const bgLayer = bgLayerRef.current;
    const watermarkGo = watermarkGoRef.current;
    const iconLeft = iconLeftRef.current;
    const speakerBtn = speakerBtnRef.current;
    const btnBeyond = btnBeyondRef.current;

    if (!pill || !heroContainer || !pillOverlay) return;

    if (phone) {
      // Mobile Mode (<= 720px)
      const pillWidth = window.innerWidth - 40;
      const finalHeight = pillWidth / 1.85;

      const pillAnim = pill.animate(
        [
          { height: '1.5px', clipPath: 'inset(0 50%)', offset: 0 },
          { height: '1.5px', clipPath: 'inset(0 0%)', easing: 'cubic-bezier(0.5, 0, 0.3, 1)', offset: 0.14 },
          { height: `${finalHeight * 0.1}px`, clipPath: 'inset(0 0%)', easing: 'cubic-bezier(0.45, 0, 0.3, 1)', offset: 0.3 },
          { height: `${finalHeight * 0.55}px`, clipPath: 'inset(0 0%)', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', offset: 0.58 },
          { height: `${finalHeight}px`, clipPath: 'inset(0 0%)', offset: 1.0 },
        ],
        { duration: DURATION, fill: 'both' }
      );
      animationsRef.current.push(pillAnim);
      primaryAnimRef.current = pillAnim;

      const gapAnim = heroContainer.animate(
        [
          { gap: `${0.03 * fs}px`, offset: 0 },
          { gap: `${0.03 * fs}px`, offset: 0.14 },
          { gap: `${0.1 * fs}px`, offset: 1.0 },
        ],
        { duration: DURATION, fill: 'both' }
      );
      animationsRef.current.push(gapAnim);
    } else {
      // Desktop Mode (> 720px)
      const w0 = 0.012 * fs; // hairline
      const w1 = 0.16 * fs;  // slit
      const w2 = 1.81 * fs;  // circle
      const w3 = 3.62 * fs;  // final stadium

      const pillAnim = pill.animate(
        [
          { width: `${w0}px`, clipPath: 'inset(50% 0)', offset: 0 },
          { width: `${w0}px`, clipPath: 'inset(0% 0)', easing: 'cubic-bezier(0.5, 0, 0.3, 1)', offset: 0.14 },
          { width: `${w1}px`, clipPath: 'inset(0% 0)', easing: 'cubic-bezier(0.45, 0, 0.3, 1)', offset: 0.3 },
          { width: `${w2}px`, clipPath: 'inset(0% 0)', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', offset: 0.58 },
          { width: `${w3}px`, clipPath: 'inset(0% 0)', offset: 1.0 },
        ],
        { duration: DURATION, fill: 'both' }
      );
      animationsRef.current.push(pillAnim);
      primaryAnimRef.current = pillAnim;

      const gapAnim = heroContainer.animate(
        [
          { gap: `${0.026 * fs}px`, offset: 0 },
          { gap: `${0.026 * fs}px`, offset: 0.14 },
          { gap: `${0.05 * fs}px`, offset: 0.58 },
          { gap: `${0.085 * fs}px`, offset: 1.0 },
        ],
        { duration: DURATION, fill: 'both' }
      );
      animationsRef.current.push(gapAnim);
    }

    // Hairline grey overlay
    const overlayAnim = pillOverlay.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.14 },
        { opacity: 0, offset: 0.3 },
        { opacity: 0, offset: 1.0 },
      ],
      { duration: DURATION, fill: 'both' }
    );
    animationsRef.current.push(overlayAnim);

    // Background paper and lines
    if (bgLayer) {
      const bgAnim = bgLayer.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.45 },
          { opacity: 1, offset: 0.78 },
          { opacity: 1, offset: 1.0 },
        ],
        { duration: DURATION, fill: 'both' }
      );
      animationsRef.current.push(bgAnim);
    }

    // Watermark "GO"
    if (watermarkGo) {
      const goAnim = watermarkGo.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.45 },
          { opacity: 0.055, offset: 0.78 },
          { opacity: 0.055, offset: 1.0 },
        ],
        { duration: DURATION, fill: 'both' }
      );
      animationsRef.current.push(goAnim);
    }

    // Pill Icons
    if (iconLeft && speakerBtn) {
      [iconLeft, speakerBtn].forEach((ic) => {
        const iconAnim = ic.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: 0.8 },
            { opacity: 0.85, offset: 1.0 },
          ],
          { duration: DURATION, fill: 'both' }
        );
        animationsRef.current.push(iconAnim);
      });
    }

    // Small button just below video ("Beyond Limits")
    if (btnBeyond) {
      const btnAnim = btnBeyond.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.8 },
          { opacity: 1, offset: 1.0 },
        ],
        { duration: DURATION, fill: 'both' }
      );
      animationsRef.current.push(btnAnim);
    }
  };

  useEffect(() => {
    buildAnimations();

    const onResize = () => {
      buildAnimations();
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(autoResetTimerRef.current);
    };
  }, []);

  // Trigger Beyond Limits Animation
  const triggerBeyondLimitsSequence = () => {
    if (isBeyondAnimating || !primaryAnimRef.current) return;
    setIsBeyondAnimating(true);
    sound.playAIPredict();
    clearTimeout(autoResetTimerRef.current);

    const btnBeyond = btnBeyondRef.current;
    if (btnBeyond) {
      btnBeyond.style.pointerEvents = 'none';
      btnBeyond.animate(
        [
          { opacity: '1', transform: 'translateX(-50%) scale(1)' },
          { opacity: '0', transform: 'translateX(-50%) scale(0.85)' },
        ],
        { duration: 240, fill: 'forwards', easing: 'ease-out' }
      );
    }

    // Step 1: Collapse back
    animationsRef.current.forEach((a) => {
      a.playbackRate = -1.25;
      a.play();
    });

    const onCollapseEnd = () => {
      primaryAnimRef.current?.removeEventListener('finish', onCollapseEnd);

      // Step 2: Limits go up to the top of the page and vanish
      const heroContainer = heroContainerRef.current;
      const watermarkGo = watermarkGoRef.current;

      const launchAnim = heroContainer?.animate(
        [
          { transform: 'translate(-50%, -50%)', opacity: 1 },
          { transform: 'translate(-50%, calc(-50% - 140vh))', opacity: 0 },
        ],
        {
          duration: 900,
          easing: 'cubic-bezier(0.4, 0, 0.15, 1)',
          fill: 'forwards',
        }
      );

      if (watermarkGo) {
        watermarkGo.animate(
          [
            { transform: 'translate(-50%, -50%)', opacity: 0.055 },
            { transform: 'translate(-50%, calc(-50% - 140vh))', opacity: 0 },
          ],
          {
            duration: 900,
            easing: 'cubic-bezier(0.4, 0, 0.15, 1)',
            fill: 'forwards',
          }
        );
      }

      if (launchAnim) {
        launchAnim.onfinish = () => {
          setIsVanished(true);
          sound.playSuccess();
          // Directly open the actual CFD website
          setTimeout(() => {
            setPage('landing');
          }, 350);
        };
      }
    };

    primaryAnimRef.current.addEventListener('finish', onCollapseEnd);
  };

  const resetAndReopen = () => {
    if (!isVanished) return;
    clearTimeout(autoResetTimerRef.current);
    setIsVanished(false);

    const heroContainer = heroContainerRef.current;
    const watermarkGo = watermarkGoRef.current;
    const btnBeyond = btnBeyondRef.current;

    if (heroContainer) {
      heroContainer.style.transform = 'translate(-50%, -50%)';
      heroContainer.style.opacity = '1';
    }
    if (watermarkGo) {
      watermarkGo.style.transform = 'translate(-50%, -50%)';
      watermarkGo.style.opacity = '0';
    }
    if (btnBeyond) {
      btnBeyond.style.pointerEvents = 'auto';
    }

    animationsRef.current.forEach((a) => {
      a.playbackRate = 1;
      a.currentTime = 0;
      a.play();
    });

    const onReopenFinish = () => {
      primaryAnimRef.current?.removeEventListener('finish', onReopenFinish);
      setIsBeyondAnimating(false);
    };
    primaryAnimRef.current?.addEventListener('finish', onReopenFinish);
  };

  const toggleSoundWaves = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWavesActive((prev) => !prev);
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden select-none bg-white text-[#1D1D1D] font-sans">
      <style>{`
        :root {
          --fs: min(18vh, 10.8vw);
          --color-page: #ffffff;
          --color-paper: #f2f2f1;
          --color-ink: #1d1d1d;
          --color-pill-placeholder: #d8d3cf;
          --color-hairline: #b9b9b9;
        }
        @media (max-width: 720px) {
          :root {
            --fs: min(28vw, 14vh);
          }
        }
      `}</style>

      {/* Background paper layer with SVG sweeping S-curve lines */}
      <div
        ref={bgLayerRef}
        className="fixed inset-0 w-full h-full bg-[#f2f2f1] pointer-events-none z-0 opacity-0"
        aria-hidden="true"
      >
        <svg
          className="w-full h-full block"
          viewBox="0 0 1920 1080"
          fill="none"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M -200,980 C 350,880 980,480 1780,120" stroke="#ffffff" strokeWidth="2.1" strokeOpacity="0.68" strokeLinecap="round" />
          <path d="M -100,1050 C 420,940 1080,420 1880,60" stroke="#ffffff" strokeWidth="3.4" strokeOpacity="0.75" strokeLinecap="round" />
          <path d="M -250,890 C 280,800 880,410 1680,80" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.62" strokeLinecap="round" />
          <path d="M 50,1120 C 560,980 1200,380 1980,-20" stroke="#ffffff" strokeWidth="2.8" strokeOpacity="0.78" strokeLinecap="round" />
          <path d="M -300,780 C 220,700 780,350 1560,40" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.56" strokeLinecap="round" />
          <path d="M 200,1180 C 700,1020 1340,320 2080,-80" stroke="#ffffff" strokeWidth="3.8" strokeOpacity="0.82" strokeLinecap="round" />
          <path d="M -150,820 C 320,720 920,330 1720,20" stroke="#ffffff" strokeWidth="2.3" strokeOpacity="0.65" strokeLinecap="round" />
          <path d="M 350,1240 C 840,1060 1480,260 2180,-140" stroke="#ffffff" strokeWidth="1.8" strokeOpacity="0.59" strokeLinecap="round" />
          <path d="M -80,720 C 380,620 990,260 1800,-40" stroke="#ffffff" strokeWidth="3.1" strokeOpacity="0.72" strokeLinecap="round" />
          <path d="M 500,1290 C 980,1100 1620,200 2280,-200" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.58" strokeLinecap="round" />
          <path d="M -350,680 C 180,590 750,230 1520,-60" stroke="#ffffff" strokeWidth="2.6" strokeOpacity="0.70" strokeLinecap="round" />
          <path d="M 650,1340 C 1120,1140 1760,140 2380,-260" stroke="#ffffff" strokeWidth="3.6" strokeOpacity="0.84" strokeLinecap="round" />
          <path d="M -40,600 C 440,510 1060,160 1860,-120" stroke="#ffffff" strokeWidth="1.3" strokeOpacity="0.55" strokeLinecap="round" />
          <path d="M 800,1390 C 1260,1180 1900,80 2480,-320" stroke="#ffffff" strokeWidth="2.4" strokeOpacity="0.66" strokeLinecap="round" />
          <path d="M 100,520 C 580,430 1200,90 1960,-180" stroke="#ffffff" strokeWidth="2.9" strokeOpacity="0.74" strokeLinecap="round" />
        </svg>
      </div>

      {/* Architectural Watermark "GO" behind LIMITS */}
      <div
        ref={watermarkGoRef}
        className="absolute top-[43%] max-sm:top-[47%] left-1/2 -translate-x-1/2 -translate-y-1/2 font-sans font-black tracking-[-0.06em] leading-[0.8] text-[#1D1D1D] opacity-0 select-none pointer-events-none z-1 uppercase whitespace-nowrap will-change-transform"
        style={{ fontSize: 'calc(2.7 * var(--fs))' }}
        aria-hidden="true"
      >
        GO
      </div>

      {/* Main Hero: LIMITS */}
      <main>
        <div
          ref={heroContainerRef}
          className="absolute top-[43%] max-sm:top-[47%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex max-sm:flex-col items-center justify-center z-5 whitespace-nowrap select-none will-change-transform"
          style={{ gap: 'calc(0.026 * var(--fs))' }}
        >
          {/* Word: LIM */}
          <span
            className="font-extrabold tracking-[-0.045em] leading-[0.8] text-[#1D1D1D] inline-block"
            style={{ fontSize: 'var(--fs)' }}
          >
            LIM
          </span>

          {/* Expanding Pill Wrapper */}
          <div className="relative flex flex-col items-center shrink-0 max-sm:w-[calc(100vw-40px)]">
            <div
              ref={pillRef}
              onClick={triggerBeyondLimitsSequence}
              role="button"
              tabIndex={0}
              aria-label="Replay reveal animation"
              title="Click to trigger Beyond Limits"
              className="relative shrink-0 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-[1.015] active:scale-[0.985] shadow-lg overflow-hidden bg-[#d8d3cf]"
              style={{
                height: 'calc(1.81 * var(--fs))',
                width: 'calc(0.012 * var(--fs))',
                borderRadius: 'calc(1.81 * var(--fs))',
                clipPath: 'inset(50% 0)',
              }}
            >
              {/* Grey hairline overlay */}
              <div
                ref={pillOverlayRef}
                className="absolute inset-0 bg-[#b9b9b9] z-3 pointer-events-none opacity-100"
              />

              {/* Video Scene */}
              <video
                ref={pillVideoRef}
                src={videoSrc}
                poster={CLOUD_POSTER_URL}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onError={() => {
                  if (videoSrc !== LOCAL_FALLBACK_VIDEO) {
                    setVideoSrc(LOCAL_FALLBACK_VIDEO);
                  }
                }}
                className="absolute top-0 left-1/2 -translate-x-1/2 h-full object-cover object-top z-1 block"
                style={{ minWidth: 'calc(4.2 * var(--fs))' }}
                aria-label="Floating cinematic cloud portal"
              />

              {/* Breeze line icon (left) */}
              <div
                ref={iconLeftRef}
                className="absolute top-1/2 -translate-y-1/2 left-[calc(0.18*var(--fs))] text-white opacity-0 z-4 flex items-center justify-center pointer-events-none"
                aria-hidden="true"
              >
                <svg
                  className="w-[calc(0.14*var(--fs))] h-[calc(0.14*var(--fs))] min-w-[18px] min-h-[18px] stroke-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                  <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                  <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
                </svg>
              </div>

              {/* Speaker icon (right) toggles its sound waves */}
              <button
                ref={speakerBtnRef}
                onClick={toggleSoundWaves}
                type="button"
                aria-label="Toggle sound waves"
                title={isWavesActive ? 'Sound waves active' : 'Sound waves muted'}
                className="absolute top-1/2 -translate-y-1/2 right-[calc(0.18*var(--fs))] text-white opacity-0 z-4 flex items-center justify-center cursor-pointer bg-transparent border-none p-0 outline-none transition-transform hover:scale-125"
              >
                <svg
                  className="w-[calc(0.14*var(--fs))] h-[calc(0.14*var(--fs))] min-w-[18px] min-h-[18px] stroke-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {isWavesActive ? (
                    <>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </>
                  ) : (
                    <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="2.5" />
                  )}
                </svg>
              </button>
            </div>

            {/* Small button just below video: Beyond Limits */}
            <button
              ref={btnBeyondRef}
              onClick={triggerBeyondLimitsSequence}
              type="button"
              aria-label="Beyond Limits"
              className="absolute top-[calc(100%+calc(0.13*var(--fs)))] max-sm:static max-sm:mt-3 left-1/2 -translate-x-1/2 max-sm:translate-x-0 bg-[#1D1D1D] hover:bg-black text-white rounded-full font-medium tracking-wide cursor-pointer whitespace-nowrap outline-none inline-flex items-center gap-2 shadow-lg opacity-0 z-6 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:scale-95"
              style={{
                padding: 'calc(0.045 * var(--fs)) calc(0.14 * var(--fs))',
                fontSize: 'max(11px, calc(0.068 * var(--fs)))',
              }}
            >
              <span>Beyond Limits</span>
              <ArrowRight className="w-3.5 h-3.5 text-sky-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Word: ITS */}
          <span
            className="font-extrabold tracking-[-0.045em] leading-[0.8] text-[#1D1D1D] inline-block"
            style={{ fontSize: 'var(--fs)' }}
          >
            ITS
          </span>
        </div>
      </main>

      {/* Top right quick jump to CFD Workbench */}
      <div className="fixed top-5 right-6 sm:right-10 z-30 flex items-center gap-2">
        <button
          onClick={() => {
            sound.playClick();
            setPage('landing');
          }}
          type="button"
          className="px-3.5 py-1.5 rounded-full text-xs font-mono font-medium text-slate-800 hover:text-black bg-white/80 hover:bg-white backdrop-blur-md border border-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
        >
          <span>Enter Workbench</span>
          <ArrowRight className="w-3 h-3 text-sky-600" />
        </button>
      </div>

      {/* Floating Return / Enter Platform Button (Appears when vanished) */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 flex items-center gap-3 ${
          isVanished ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
      >
        <button
          ref={btnReturnRef}
          onClick={resetAndReopen}
          type="button"
          aria-label="Return to Limits"
          className="bg-white text-slate-900 border border-slate-300 rounded-full px-5 py-2.5 text-xs font-semibold tracking-wide inline-flex items-center gap-2 shadow-xl hover:bg-slate-50 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
          <span>Replay Limits</span>
        </button>

        <button
          onClick={() => setPage('landing')}
          type="button"
          aria-label="Enter CFD Workbench"
          className="bg-[#1D1D1D] text-white rounded-full px-6 py-2.5 text-xs font-bold tracking-wider uppercase inline-flex items-center gap-2 shadow-xl hover:bg-black transition-all cursor-pointer transform hover:scale-105"
        >
          <span>Enter CFD Workbench</span>
          <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
        </button>
      </div>
    </div>
  );
};
