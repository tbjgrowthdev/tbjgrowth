import React from 'react';

type SchemaType = 'Organization' | 'LocalBusiness' | 'Article' | 'FAQPage' | 'Service';

interface SchemaRendererProps {
  type: SchemaType;
  data: any;
}

export default function SchemaRenderer({ type, data }: SchemaRendererProps) {
  let schema = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };

  // Pre-fill defaults based on type
  if (type === 'Article') {
    schema = {
      ...schema,
      publisher: {
        "@type": "Organization",
        name: "TBJ Growth",
        // logo: { "@type": "ImageObject", url: "..." }
      }
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
