// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * \u5a92\u4f53\u9884\u89c8\u6a21\u6001\u7ec4\u4ef6 (Media Preview Modals)
 * sử dụng\u4e8e\u5168\u5c4f\u9884\u89c8\u56fe\u7247và\u89c6\u9891
 * \u652f\u6301: HTTP URL / data URI / local-image:// \u534f\u8bae
 */

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ImagePreviewModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImagePreviewModal({ 
  imageUrl, 
  isOpen, 
  onClose 
}: ImagePreviewModalProps) {
  // Escape \u952e\u5173\u95ed
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    // \u963b\u6b62\u80cc\u666f\u6eda\u52a8
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center cursor-zoom-out"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img 
          src={imageUrl} 
          alt="Preview" 
          className="max-w-[90vw] max-h-[90vh] object-contain rounded"
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/40 px-3 py-1 rounded-full pointer-events-none">
          \u70b9\u51fb\u7a7a\u767d\u5904hoặc\u6309 Esc \u5173\u95ed
        </div>
      </div>
    </div>
  );
}

interface VideoPreviewModalProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPreviewModal({ 
  videoUrl, 
  isOpen, 
  onClose 
}: VideoPreviewModalProps) {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <video 
          src={videoUrl} 
          controls
          autoPlay
          className="max-w-full max-h-[90vh] object-contain"
        />
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
