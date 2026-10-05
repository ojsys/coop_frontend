import { useRef } from 'react'
import { Field } from './Field'
import { Button } from './Button'
import { Icon } from './Icon'

/**
 * Raster formats only. The server stores these on a Django ImageField, which
 * validates through Pillow — Pillow cannot read SVG, so offering `image/*`
 * lets people pick a file the API will reject with "Upload a valid image".
 */
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp'
const FORMAT_HINT = 'PNG, JPG or WebP — SVG is not supported.'

/**
 * Image upload control: a preview tile beside a button that opens a hidden
 * file input — the same pattern as the member headshot uploader.
 *
 * Shared by the cooperative's branding (console → Settings) and the platform's
 * own (platform → Settings), so the two stay visually identical.
 */
export function BrandAssetField({
  label,
  hint,
  url,
  field,
  onUpload,
  pending,
  round = false,
  accept = ACCEPTED_TYPES,
}: {
  label: string
  hint: string
  url?: string | null
  field: 'logo' | 'favicon'
  onUpload: (field: 'logo' | 'favicon', file: File) => void
  pending: boolean
  round?: boolean
  accept?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <Field label={label} hint={`${hint} ${FORMAT_HINT}`}>
      <div className="flex items-center gap-3">
        <div
          className={`flex size-14 shrink-0 items-center justify-center overflow-hidden border border-line bg-paper ${
            round ? 'rounded-full' : 'rounded-lg'
          }`}
        >
          {url ? (
            <img src={url} alt="" className="size-full object-contain" />
          ) : (
            <Icon name="image" size={20} className="text-muted-2" />
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon="upload"
          loading={pending}
          onClick={() => ref.current?.click()}
        >
          {url ? 'Replace' : 'Upload'}
        </Button>
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(field, file)
            e.target.value = '' // let the same file be picked again
          }}
        />
      </div>
    </Field>
  )
}
