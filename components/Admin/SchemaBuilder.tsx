import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';

interface SchemaBuilderProps {
  initialSchema: string;
  onChange: (schema: string) => void;
}

const SCHEMA_TYPES = ['Organization', 'LocalBusiness', 'Service', 'Article', 'BlogPosting', 'FAQPage', 'Review'];

export default function SchemaBuilder({ initialSchema, onChange }: SchemaBuilderProps) {
  const [schemaType, setSchemaType] = useState('Organization');
  const [schemaData, setSchemaData] = useState<any>({});
  const [jsonText, setJsonText] = useState(initialSchema || '');
  const [mode, setMode] = useState<'visual' | 'code'>('code');

  useEffect(() => {
    if (initialSchema) {
      try {
        const parsed = JSON.parse(initialSchema);
        if (parsed['@type']) {
          setSchemaType(parsed['@type']);
          setSchemaData(parsed);
        }
      } catch (e) {
        // invalid JSON
      }
    }
  }, [initialSchema]);

  const commit = (newData: any) => {
    setSchemaData(newData);
    const newJson = JSON.stringify(newData, null, 2);
    setJsonText(newJson);
    onChange(newJson);
  };

  const updateSchema = (key: string, value: any) => {
    commit({ ...schemaData, '@context': 'https://schema.org', '@type': schemaType, [key]: value });
  };

  const updateNested = (path: string[], value: any) => {
    const newData = { ...schemaData, '@context': 'https://schema.org', '@type': schemaType };
    let cursor = newData;
    for (let i = 0; i < path.length - 1; i++) {
      cursor[path[i]] = { ...(cursor[path[i]] || {}) };
      cursor = cursor[path[i]];
    }
    cursor[path[path.length - 1]] = value;
    commit(newData);
  };

  const SKELETONS: Record<string, any> = {
    LocalBusiness: { address: { '@type': 'PostalAddress' } },
    Service: { provider: { '@type': 'Organization' } },
    Review: {
      itemReviewed: { '@type': 'Organization' },
      author: { '@type': 'Person' },
      reviewRating: { '@type': 'Rating' },
    },
    FAQPage: { mainEntity: [] },
  };

  const handleTypeChange = (newType: string) => {
    setSchemaType(newType);
    commit({
      '@context': 'https://schema.org',
      '@type': newType,
      ...(SKELETONS[newType] || {}),
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonText(e.target.value);
    onChange(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      if (parsed['@type']) {
        setSchemaType(parsed['@type']);
        setSchemaData(parsed);
      }
    } catch (e) {}
  };

  const faqItems: { question: string; answer: string }[] =
    schemaData.mainEntity?.map((q: any) => ({
      question: q.name || '',
      answer: q.acceptedAnswer?.text || '',
    })) || [];

  const updateFaqItems = (items: { question: string; answer: string }[]) => {
    updateSchema(
      'mainEntity',
      items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      }))
    );
  };

  const inputClass = "w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-transparent";
  const labelClass = "block text-sm mb-1";

  const renderVisualFields = () => {
    switch (schemaType) {
      case 'Organization':
        return (
          <>
            <div><label className={labelClass}>Name</label><input type="text" value={schemaData.name || ''} onChange={(e) => updateSchema('name', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>URL</label><input type="text" value={schemaData.url || ''} onChange={(e) => updateSchema('url', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Logo URL</label><input type="text" value={schemaData.logo || ''} onChange={(e) => updateSchema('logo', e.target.value)} className={inputClass} /></div>
          </>
        );

      case 'LocalBusiness':
        return (
          <>
            <div><label className={labelClass}>Business Name</label><input type="text" value={schemaData.name || ''} onChange={(e) => updateSchema('name', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Telephone</label><input type="text" value={schemaData.telephone || ''} onChange={(e) => updateSchema('telephone', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Price Range</label><input type="text" value={schemaData.priceRange || ''} onChange={(e) => updateSchema('priceRange', e.target.value)} placeholder="£££" className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>Street Address</label><input type="text" value={schemaData.address?.streetAddress || ''} onChange={(e) => updateNested(['address', 'streetAddress'], e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>City</label><input type="text" value={schemaData.address?.addressLocality || ''} onChange={(e) => updateNested(['address', 'addressLocality'], e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Postal Code</label><input type="text" value={schemaData.address?.postalCode || ''} onChange={(e) => updateNested(['address', 'postalCode'], e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Country</label><input type="text" value={schemaData.address?.addressCountry || 'GB'} onChange={(e) => updateNested(['address', 'addressCountry'], e.target.value)} className={inputClass} /></div>
            </div>
          </>
        );

      case 'Service':
        return (
          <>
            <div><label className={labelClass}>Service Name</label><input type="text" value={schemaData.name || ''} onChange={(e) => updateSchema('name', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Description</label><textarea rows={2} value={schemaData.description || ''} onChange={(e) => updateSchema('description', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Provider (Organization Name)</label><input type="text" value={schemaData.provider?.name || ''} onChange={(e) => updateNested(['provider', 'name'], e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Area Served</label><input type="text" value={schemaData.areaServed || ''} onChange={(e) => updateSchema('areaServed', e.target.value)} placeholder="United Kingdom" className={inputClass} /></div>
          </>
        );

      case 'Article':
      case 'BlogPosting':
        return (
          <>
            <div><label className={labelClass}>Headline</label><input type="text" value={schemaData.headline || ''} onChange={(e) => updateSchema('headline', e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Image URL</label><input type="text" value={schemaData.image || ''} onChange={(e) => updateSchema('image', e.target.value)} className={inputClass} /></div>
          </>
        );

      case 'FAQPage':
        return (
          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <div key={i} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2 relative">
                <button
                  type="button"
                  onClick={() => updateFaqItems(faqItems.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 size={14} />
                </button>
                <div>
                  <label className={labelClass}>Question</label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateFaqItems(faqItems.map((it, idx) => (idx === i ? { ...it, question: e.target.value } : it)))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Answer</label>
                  <textarea
                    rows={2}
                    value={item.answer}
                    onChange={(e) => updateFaqItems(faqItems.map((it, idx) => (idx === i ? { ...it, answer: e.target.value } : it)))}
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateFaqItems([...faqItems, { question: '', answer: '' }])}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus size={14} /> Add Question
            </button>
          </div>
        );

      case 'Review':
        return (
          <>
            <div><label className={labelClass}>Item Reviewed (Name)</label><input type="text" value={schemaData.itemReviewed?.name || ''} onChange={(e) => updateNested(['itemReviewed', 'name'], e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Author Name</label><input type="text" value={schemaData.author?.name || ''} onChange={(e) => updateNested(['author', 'name'], e.target.value)} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Rating (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={schemaData.reviewRating?.ratingValue || ''}
                onChange={(e) => updateNested(['reviewRating', 'ratingValue'], Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div><label className={labelClass}>Review Body</label><textarea rows={3} value={schemaData.reviewBody || ''} onChange={(e) => updateSchema('reviewBody', e.target.value)} className={inputClass} /></div>
          </>
        );

      default:
        return <div className="text-sm text-gray-500">Visual builder not available for this schema type yet. Use code editor.</div>;
    }
  };

  const renderPreview = () => {
    switch (schemaType) {
      case 'FAQPage':
        return faqItems.length > 0 ? (
          <div className="space-y-2">
            {faqItems.filter((i) => i.question).map((item, i) => (
              <div key={i} className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{item.question}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.answer}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">Add questions to preview the FAQ rich result.</p>;

      case 'Review':
        return (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{schemaData.itemReviewed?.name || 'Item Name'}</p>
            <div className="flex items-center gap-1 my-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} className={i < (schemaData.reviewRating?.ratingValue || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
              ))}
              <span className="text-xs text-gray-500 ml-1">by {schemaData.author?.name || 'Reviewer'}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{schemaData.reviewBody}</p>
          </div>
        );

      case 'LocalBusiness':
        return (
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{schemaData.name || 'Business Name'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {[schemaData.address?.streetAddress, schemaData.address?.addressLocality, schemaData.address?.postalCode].filter(Boolean).join(', ')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{schemaData.telephone} {schemaData.priceRange}</p>
          </div>
        );

      default:
        return (
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{schemaData.name || schemaData.headline || 'Preview title'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{schemaData.description || schemaData.reviewBody || `Type: ${schemaType}`}</p>
          </div>
        );
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setMode('visual')}
          className={`px-4 py-2 text-sm font-medium ${mode === 'visual' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
          Visual Builder
        </button>
        <button
          type="button"
          onClick={() => setMode('code')}
          className={`px-4 py-2 text-sm font-medium ${mode === 'code' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
          JSON-LD Editor
        </button>
      </div>

      <div className="p-4">
        {mode === 'visual' ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className={labelClass + " font-medium"}>Schema Type</label>
                <select
                  value={schemaType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className={inputClass}
                >
                  {SCHEMA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {renderVisualFields()}
            </div>
            <div>
              <label className={labelClass + " font-medium"}>Rich Snippet Preview</label>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                {renderPreview()}
              </div>
            </div>
          </div>
        ) : (
          <textarea
            rows={10}
            value={jsonText}
            onChange={handleTextChange}
            className="w-full p-3 font-mono text-sm bg-gray-50 dark:bg-gray-900 border rounded"
            placeholder="{\n  &quot;@context&quot;: &quot;https://schema.org&quot;,\n  &quot;@type&quot;: &quot;Organization&quot;\n}"
          />
        )}
      </div>
    </div>
  );
}
