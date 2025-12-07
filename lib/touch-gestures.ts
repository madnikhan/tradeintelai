/**
 * Touch Gesture Handler
 * Provides swipe gestures for mobile navigation
 */

import React, { useEffect, useRef, RefObject } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

const SWIPE_THRESHOLD = 50; // Minimum distance in pixels
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity
const MAX_SWIPE_TIME = 300; // Maximum time in ms

export function useSwipeGesture(
  elementRef: RefObject<HTMLElement>,
  handlers: SwipeHandlers
) {
  const touchState = useRef<TouchState | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchState.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.current.startX;
      const deltaY = touch.clientY - touchState.current.startY;
      const deltaTime = Date.now() - touchState.current.startTime;
      const velocityX = Math.abs(deltaX) / deltaTime;
      const velocityY = Math.abs(deltaY) / deltaTime;

      // Check if it's a valid swipe
      if (deltaTime > MAX_SWIPE_TIME) {
        touchState.current = null;
        return;
      }

      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocityX > SWIPE_VELOCITY_THRESHOLD) {
          if (deltaX > 0 && handlers.onSwipeRight) {
            handlers.onSwipeRight();
          } else if (deltaX < 0 && handlers.onSwipeLeft) {
            handlers.onSwipeLeft();
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > SWIPE_THRESHOLD || velocityY > SWIPE_VELOCITY_THRESHOLD) {
          if (deltaY > 0 && handlers.onSwipeDown) {
            handlers.onSwipeDown();
          } else if (deltaY < 0 && handlers.onSwipeUp) {
            handlers.onSwipeUp();
          }
        }
      }

      touchState.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, handlers]);
}

/**
 * Simple swipe detection without React hooks
 */
export function attachSwipeListeners(
  element: HTMLElement,
  handlers: SwipeHandlers
): () => void {
  let touchState: TouchState | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    touchState = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchState) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;
    const deltaTime = Date.now() - touchState.startTime;
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    if (deltaTime > MAX_SWIPE_TIME) {
      touchState = null;
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocityX > SWIPE_VELOCITY_THRESHOLD) {
        if (deltaX > 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        } else if (deltaX < 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        }
      }
    } else {
      if (Math.abs(deltaY) > SWIPE_THRESHOLD || velocityY > SWIPE_VELOCITY_THRESHOLD) {
        if (deltaY > 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown();
        } else if (deltaY < 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp();
        }
      }
    }

    touchState = null;
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
  };
}

