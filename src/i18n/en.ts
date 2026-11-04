export const en = {
  app: { name: 'DataCanvas', tagline: 'Turn Excel and CSV files into interactive dashboards without uploading your data.' },
  privacy: { badge: 'Processed on your device. The file is never uploaded.' },
  upload: { cta: 'Choose a file or drop it here', hint: 'CSV or XLSX', loading: 'Reading file…' },
  preview: { title: 'Data preview', counts: 'Detected {{rows}} rows and {{columns}} columns' },
  profile: {
    type: { string: 'Text', number: 'Number', date: 'Date', boolean: 'Yes/No' },
    role: { dimension: 'Category', measure: 'Measure', identifier: 'Identifier', unknown: 'Unclassified' },
    dateNeedsConfirmation: 'The date format in some columns is unclear (for example 03/04/2026). You will be asked to confirm it before analysis.',
  },
  errors: {
    'file-too-large': 'The file is larger than the 50 MB limit.',
    'unsupported-type': 'Unsupported file type. Use CSV or XLSX.',
    empty: 'The file is empty.',
    'too-many-rows': 'The file has more rows than the limit.',
    'too-many-columns': 'The file has more columns than the limit.',
    'parse-failed': 'This file could not be read.',
    unknown: 'An unexpected error occurred.',
  },
  lang: { switch: 'العربية' },
};
