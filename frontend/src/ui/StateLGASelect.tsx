import { usePublicReference, useCountrySubdivisions } from '@/api/public'
import { Field, Select } from './Field'

/**
 * Location capture, country-first.
 *
 * Three levels — country → region → locality — because that is the most any
 * country we serve needs and the fewest that works everywhere. What each
 * level is *called* comes from the backend catalogue, so a Kenyan officer is
 * asked for a County and a Nigerian one for an LGA.
 *
 * Where we ship a verified subdivision list the lower two levels are
 * dropdowns; everywhere else they are text inputs. That asymmetry is
 * deliberate: a typed province name is more honest than a list we have not
 * checked, and it means adding a country is a data change, not a code change.
 *
 * Fed by the *public* catalogue endpoint so this component behaves identically
 * on the signed-out signup form and inside the console.
 */
export function LocationSelect({
  country,
  state,
  lga,
  onCountry,
  onState,
  onLga,
}: {
  country: string
  state: string
  lga: string
  onCountry: (v: string) => void
  onState: (v: string) => void
  onLga: (v: string) => void
}) {
  const { data } = usePublicReference()
  const countries = data?.countries ?? []
  const selected = countries.find((c) => c.code === country)

  // Only ask for regions when the chosen country actually has a list.
  const { data: subs } = useCountrySubdivisions(
    selected?.has_subdivisions ? country : undefined,
  )
  const regions = subs?.regions ?? []
  const currentRegion = regions.find((r) => r.region === state)

  const regionLabel = selected?.region_label ?? 'State / Province'
  const localityLabel = selected?.locality_label ?? 'City / District'
  const useDropdowns = Boolean(selected?.has_subdivisions) && regions.length > 0

  return (
    <div className="space-y-3">
      <Field label="Country">
        <Select
          value={country}
          onChange={(e) => {
            onCountry(e.target.value)
            // The levels below belong to the old country — clear both.
            onState('')
            onLga('')
          }}
          options={[
            { value: '', label: 'Select country…' },
            ...countries.map((c) => ({ value: c.code, label: c.name })),
          ]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={regionLabel}>
          {useDropdowns ? (
            <Select
              value={state}
              onChange={(e) => {
                onState(e.target.value)
                onLga('') // reset the locality when the region changes
              }}
              options={[
                { value: '', label: `Select ${regionLabel.toLowerCase()}…` },
                ...regions.map((r) => ({ value: r.region, label: r.region })),
              ]}
            />
          ) : (
            <input
              className="input"
              value={state}
              disabled={!country}
              placeholder={country ? regionLabel : 'Pick a country first'}
              onChange={(e) => onState(e.target.value)}
            />
          )}
        </Field>

        <Field label={localityLabel}>
          {useDropdowns ? (
            <Select
              value={lga}
              onChange={(e) => onLga(e.target.value)}
              disabled={!currentRegion}
              options={[
                {
                  value: '',
                  label: currentRegion
                    ? `Select ${localityLabel.toLowerCase()}…`
                    : `Pick a ${regionLabel.toLowerCase()} first`,
                },
                ...(currentRegion?.localities ?? []).map((l) => ({
                  value: l,
                  label: l,
                })),
              ]}
            />
          ) : (
            <input
              className="input"
              value={lga}
              disabled={!country}
              placeholder={country ? localityLabel : 'Pick a country first'}
              onChange={(e) => onLga(e.target.value)}
            />
          )}
        </Field>
      </div>
    </div>
  )
}

/** Cooperative-type dropdown, fed by the same public catalogue. */
export function CoopTypeSelect({
  value,
  onChange,
  label = 'Type',
}: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  const { data } = usePublicReference()
  const types = data?.coop_types ?? []
  // Preserve a legacy free-text value that isn't in the catalogue.
  const options = value && !types.includes(value) ? [value, ...types] : types
  return (
    <Field label={label}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[
          { value: '', label: 'Select type…' },
          ...options.map((t) => ({ value: t, label: t })),
        ]}
      />
    </Field>
  )
}
