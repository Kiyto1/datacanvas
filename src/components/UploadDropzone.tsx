import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFile, disabled = false }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-card border-2 border-dashed p-12 text-center transition-colors ${
        dragging ? 'border-brand bg-brand/5' : 'border-line bg-surface'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls"
        className="sr-only"
        aria-label={t('upload.cta')}
        data-testid="file-input"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="font-semibold text-brand hover:underline disabled:opacity-50"
      >
        {t('upload.cta')}
      </button>
      <p className="mt-1 text-sm text-muted">{t('upload.hint')}</p>
    </div>
  );
}
