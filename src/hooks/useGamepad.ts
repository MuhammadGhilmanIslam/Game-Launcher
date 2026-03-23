import { useEffect, useRef, useCallback, useState } from 'react';

interface GamepadCallbacks {
  onNavigate: (direction: 'left' | 'right' | 'up' | 'down') => void;
  onLaunch: () => void;
  onBack: () => void;
  onSearch: () => void;
  onFavorite: () => void;
}

export function useGamepad(callbacks: GamepadCallbacks, enabled = true) {
  const [isConnected, setIsConnected] = useState(false);
  const rafRef = useRef<number>(0);
  const lastFire = useRef<Map<number, number>>(new Map());
  const DEBOUNCE = 160; // ms

  const canFire = useCallback((btnIndex: number): boolean => {
    const now = Date.now();
    const last = lastFire.current.get(btnIndex) ?? 0;
    if (now - last < DEBOUNCE) return false;
    lastFire.current.set(btnIndex, now);
    return true;
  }, []);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    
    // Check if one is already connected on mount
    if (navigator.getGamepads().some(gp => gp !== null)) {
      setIsConnected(true);
    }

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const poll = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0]; // First controller

      if (gp) {
        if (!isConnected) setIsConnected(true); // Failsafe
        const b = gp.buttons;
        const ax = gp.axes;

        // D-Pad
        if (b[15]?.pressed && canFire(15)) callbacks.onNavigate('right');
        if (b[14]?.pressed && canFire(14)) callbacks.onNavigate('left');
        if (b[12]?.pressed && canFire(12)) callbacks.onNavigate('up');
        if (b[13]?.pressed && canFire(13)) callbacks.onNavigate('down');

        // Analog stick kiri
        const DEADZONE = 0.3;
        if (ax[0] > DEADZONE && canFire(100)) callbacks.onNavigate('right');
        if (ax[0] < -DEADZONE && canFire(101)) callbacks.onNavigate('left');
        if (ax[1] < -DEADZONE && canFire(102)) callbacks.onNavigate('up');
        if (ax[1] > DEADZONE && canFire(103)) callbacks.onNavigate('down');

        // Action buttons
        if (b[0]?.pressed && canFire(0)) callbacks.onLaunch();    // A / Cross
        if (b[1]?.pressed && canFire(1)) callbacks.onBack();      // B / Circle
        if (b[2]?.pressed && canFire(2)) callbacks.onFavorite();  // X / Square
        if (b[9]?.pressed && canFire(9)) callbacks.onSearch();    // Start / Options

        // Haptic feedback
        if (gp.vibrationActuator && (b[15]?.pressed || b[14]?.pressed || b[12]?.pressed || b[13]?.pressed)) {
          gp.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 60,
            weakMagnitude: 0.1,
            strongMagnitude: 0.0
          }).catch(() => {});
        }
      }

      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);

    return () => cancelAnimationFrame(rafRef.current);
  }, [callbacks, canFire, enabled, isConnected]);

  return { isConnected };
}
