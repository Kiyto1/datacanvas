import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** Secondary action shown beside the picker (the sample-data button). */
  extra?: ReactNode;
}

export function UploadDropzone({ onFile, disabled = false, extra }: Props) {
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
      data-dragging={dragging}
      data-testid="dropzone"
      className={`flex flex-col gap-4 rounded-xl border border-dashed p-3.5 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between sm:ps-4 ${
        dragging ? 'border-brand bg-brand-wash' : 'border-line-strong bg-surface'
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
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-wash text-brand-strong">
          <Icon name="upload" size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.95rem] font-medium leading-snug">{t('upload.cta')}</p>
          <p className="mt-0.5 text-sm text-muted">{t('upload.hint')}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="primary" disabled={disabled} onClick={() => inputRef.current?.click()} data-testid="pick-file">
          {t('upload.pick')}
        </Button>
        {extra}
      </div>
    </div>
  );
}
