export const ar = {
  app: { name: 'داتا كانفس', tagline: 'حوّل ملفات Excel وCSV إلى لوحات تفاعلية، دون رفع بياناتك.' },
  privacy: { badge: 'تتم المعالجة على جهازك. لا يتم رفع الملف.' },
  upload: { cta: 'اختر ملفًا أو اسحبه هنا', hint: 'CSV أو XLSX', loading: 'جارٍ قراءة الملف…' },
  preview: { title: 'معاينة البيانات', counts: 'تم اكتشاف {{rows}} سجلًا و{{columns}} أعمدة' },
  profile: {
    type: { string: 'نص', number: 'رقم', date: 'تاريخ', boolean: 'نعم/لا' },
    role: { dimension: 'تصنيف', measure: 'قيمة قابلة للقياس', identifier: 'معرّف', unknown: 'غير محدد' },
    dateNeedsConfirmation: 'صيغة التاريخ في بعض الأعمدة غير واضحة (مثل 03/04/2026). سنطلب منك تأكيدها قبل التحليل.',
  },
  errors: {
    'file-too-large': 'حجم الملف أكبر من الحد المسموح (50 ميغابايت).',
    'unsupported-type': 'نوع الملف غير مدعوم. استخدم CSV أو XLSX.',
    empty: 'الملف فارغ.',
    'too-many-rows': 'عدد السجلات أكبر من الحد المسموح.',
    'too-many-columns': 'عدد الأعمدة أكبر من الحد المسموح.',
    'parse-failed': 'تعذّرت قراءة هذا الملف.',
    unknown: 'حدث خطأ غير متوقع.',
  },
  lang: { switch: 'English' },
};
