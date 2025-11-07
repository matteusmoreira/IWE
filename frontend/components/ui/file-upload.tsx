'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, File as FileIcon, Loader2 } from 'lucide-react';
import { Button } from './button';
import { toast } from 'sonner';

interface FileUploadProps {
  onFileSelect: (file: File | null, url?: string) => void;
  accept?: string;
  maxSize?: number; // in bytes
  value?: string; // URL of uploaded file
  disabled?: boolean;
}

export function FileUpload({ 
  onFileSelect, 
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  maxSize = 10 * 1024 * 1024, // 10MB default
  value,
  disabled = false 
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Atualiza a pré-visualização quando o "value" (URL) muda externamente
  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Tamanho máximo: ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
      return;
    }

    setFileName(file.name);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    onFileSelect(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelect(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />

      {!preview && !fileName ? (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-primary hover:bg-brand-primary/5'}
          `}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Clique para selecionar ou arraste um arquivo
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Máximo: {(maxSize / 1024 / 1024).toFixed(0)}MB
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          {preview && preview.startsWith('data:image') ? (
            <div className="relative">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-full h-48 object-contain rounded"
              />
              {!disabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemove}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileIcon className="h-8 w-8 text-brand-primary" />
                <div>
                  <p className="text-sm font-medium">{fileName || 'Arquivo selecionado'}</p>
                  <p className="text-xs text-muted-foreground">
                    {preview ? 'Carregado' : 'Pronto para enviar'}
                  </p>
                </div>
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemove}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
