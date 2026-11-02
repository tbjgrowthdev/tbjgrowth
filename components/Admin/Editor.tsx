"use client";

import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote, Undo, Redo, ImagePlus, X } from 'lucide-react'
import ImageInput from './Media/ImageInput'

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
}

// Insert-image dialog: the same image field as everywhere else in the
// admin (URL, device upload, drag & drop / paste, Media Library), then the
// image goes into the post at the cursor with its alt text.
const InsertImageDialog = ({ editor, onClose }: { editor: any; onClose: () => void }) => {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')

  const insert = () => {
    if (!url.trim()) return
    editor.chain().focus().setImage({ src: url.trim(), alt: alt.trim() }).run()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insert image"
        className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        // The editor sits inside the content form: Enter here must not submit it.
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault()
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Insert image</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-caption hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <ImageInput folder="Content" value={url} onChange={setUrl} altText={alt} onAltTextChange={setAlt} previewClassName="w-32 h-24" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint">
            Cancel
          </button>
          <button
            type="button"
            onClick={insert}
            disabled={!url.trim() || !alt.trim()}
            title={!alt.trim() ? 'Add alt text first' : undefined}
            className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
          >
            Insert image
          </button>
        </div>
      </div>
    </div>
  )
}

const MenuBar = ({ editor }: { editor: any }) => {
  const [showImageDialog, setShowImageDialog] = useState(false)

  if (!editor) {
    return null
  }

  return (
    <div className="border border-border rounded-t-lg bg-background p-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('bold') ? 'bg-tint' : ''}`}
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('italic') ? 'bg-tint' : ''}`}
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('strike') ? 'bg-tint' : ''}`}
      >
        <Strikethrough size={16} />
      </button>
      
      <div className="w-px h-6 bg-border mx-1 self-center" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('heading', { level: 1 }) ? 'bg-tint' : ''}`}
      >
        <Heading1 size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('heading', { level: 2 }) ? 'bg-tint' : ''}`}
      >
        <Heading2 size={16} />
      </button>

      <div className="w-px h-6 bg-border mx-1 self-center" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('bulletList') ? 'bg-tint' : ''}`}
      >
        <List size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('orderedList') ? 'bg-tint' : ''}`}
      >
        <ListOrdered size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-2 rounded hover:bg-tint ${editor.isActive('blockquote') ? 'bg-tint' : ''}`}
      >
        <Quote size={16} />
      </button>

      <div className="w-px h-6 bg-border mx-1 self-center" />

      <button
        type="button"
        onClick={() => setShowImageDialog(true)}
        className="p-2 rounded hover:bg-tint"
        title="Insert image"
        aria-label="Insert image"
      >
        <ImagePlus size={16} />
      </button>
      {showImageDialog && <InsertImageDialog editor={editor} onClose={() => setShowImageDialog(false)} />}

      <div className="w-px h-6 bg-border mx-1 self-center" />

      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="p-2 rounded hover:bg-tint disabled:opacity-50"
      >
        <Undo size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="p-2 rounded hover:bg-tint disabled:opacity-50"
      >
        <Redo size={16} />
      </button>
    </div>
  )
}

export default function RichTextEditor({ content, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      // Block images only, and never inline base64: every image comes from a URL (usually the Media Library).
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4 border border-border border-t-0 rounded-b-lg dark:prose-invert max-w-none',
      },
    },
  })

  return (
    <div className="w-full">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
